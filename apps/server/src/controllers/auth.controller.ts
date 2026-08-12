import { Request, Response, NextFunction } from 'express';
import { User } from '../models/User';
import { Workspace } from '../models/Workspace';
import { PasswordResetToken } from '../models/PasswordResetToken';
import { UserSession } from '../models/UserSession';
import * as argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import {
  clearAuthCookies,
  generateTokens,
  REFRESH_TOKEN_COOKIE,
  revokeAllUserSessions,
  revokeRefreshToken,
  setAuthCookies,
  verifyRefreshToken,
} from '../services/auth.service';
import { redis } from '../config/redis';
import { env } from '../config/env';
import { sendEmail } from '../services/email.service';
import { welcomeEmail, passwordResetEmail, verificationEmail } from '../utils/emailTemplates';
import { OTP } from 'otplib';
import QRCode from 'qrcode';
import { OAuth2Client } from 'google-auth-library';
import { validatePasswordPolicy } from '../services/passwordPolicy.service';
import { generateRecoveryCodes, randomToken, sha256, verifyRecoveryCode } from '../services/security.service';

const otp = new OTP();
const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);
const GENERIC_LOGIN_ERROR = 'Invalid email or password';
const RESET_MESSAGE = 'If an account exists with that email, a password reset link has been sent.';

const publicUser = (user: any) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  mfaEnabled: user.mfaEnabled,
  isEmailVerified: user.isEmailVerified,
});

const recordFailedLogin = async (user: any) => {
  user.failedLoginCount = (user.failedLoginCount || 0) + 1;
  if (user.failedLoginCount >= 5) {
    const lockMinutes = Math.min(60, 2 ** Math.min(user.failedLoginCount - 5, 4) * 5);
    user.lockoutUntil = new Date(Date.now() + lockMinutes * 60 * 1000);
  }
  await user.save();
};

const clearFailedLogins = async (user: any) => {
  user.failedLoginCount = 0;
  user.lockoutUntil = undefined;
  user.lastLoginAt = new Date();
  await user.save();
};

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, password } = req.body;

    const passwordErrors = validatePasswordPolicy(password, { email, name });
    if (passwordErrors.length > 0) {
      return res.status(400).json({ error: 'Password does not meet security requirements', details: passwordErrors });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ error: 'Email already exists' });
    }

    const user = new User({ name, email, passwordHash: password }); // pre-save hook hashes it with argon2
    await user.save();

    // 2026 Standard: Auto-provision a personal workspace on registration
    const workspace = new Workspace({
      name: `${name}'s Workspace`,
      ownerId: user._id,
      members: [{ userId: user._id, role: 'owner', joinedAt: new Date() }],
      plan: 'free',
      maxPages: 10,
    });
    await workspace.save();

    const tokens = await generateTokens(user.id, user.role, req);
    setAuthCookies(res, tokens);

    // Generate verification token
    const verificationToken = jwt.sign(
      { userId: user.id },
      env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    const verificationUrl = `${env.CLIENT_URL || 'http://localhost:5173'}/verify-email?token=${verificationToken}`;

    // 2026 Standard: Send welcome + verification email (fire-and-forget)
    sendEmail({
      to: email,
      subject: 'Deltaora — Verify Your Email',
      htmlContent: verificationEmail(verificationUrl),
    }).catch(err => console.error('Failed to send verification email:', err));

    res.status(201).json({ accessToken: tokens.accessToken, user: publicUser(user), workspaceId: workspace.id });
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, mfaCode, recoveryCode } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: GENERIC_LOGIN_ERROR });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ error: 'Account is not active' });
    }

    if (user.lockoutUntil && user.lockoutUntil > new Date()) {
      return res.status(429).json({ error: 'Account temporarily locked. Use password reset or try again later.' });
    }

    if (!user.passwordHash) {
      return res.status(401).json({ error: 'Please sign in with Google or reset your password' });
    }

    const isValid = await argon2.verify(user.passwordHash, password);
    if (!isValid) {
      await recordFailedLogin(user);
      return res.status(401).json({ error: GENERIC_LOGIN_ERROR });
    }

    if (user.mfaEnabled) {
      if (!mfaCode && !recoveryCode) {
        return res.status(401).json({ error: 'MFA_REQUIRED', message: 'Multi-factor authentication required' });
      }

      const mfaResult = mfaCode
        ? await otp.verify({ token: mfaCode, secret: user.mfaSecret! })
        : { valid: false };
      const usedRecoveryHash = !mfaResult.valid && recoveryCode
        ? await verifyRecoveryCode(user.mfaRecoveryCodeHashes, recoveryCode)
        : null;

      if (!mfaResult.valid && !usedRecoveryHash) {
        await recordFailedLogin(user);
        return res.status(401).json({ error: 'INVALID_MFA', message: 'Invalid authentication code' });
      }

      if (usedRecoveryHash) {
        user.mfaRecoveryCodeHashes = user.mfaRecoveryCodeHashes.filter((hash: string) => hash !== usedRecoveryHash);
      }
    }

    await clearFailedLogins(user);
    const tokens = await generateTokens(user.id, user.role, req);
    setAuthCookies(res, tokens);

    // Return default workspace on login
    const workspace = await Workspace.findOne({ 'members.userId': user._id });

    res.status(200).json({ 
      accessToken: tokens.accessToken,
      user: publicUser(user),
      defaultWorkspaceId: workspace?.id
    });
  } catch (error) {
    next(error);
  }
};

export const refresh = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];
    if (!refreshToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const decoded = verifyRefreshToken(refreshToken);

    const refreshTokenHash = sha256(refreshToken);
    const isValidInRedis = await redis.get(`refresh_token:${decoded.sessionId}`);
    const session = await UserSession.findOne({
      _id: decoded.sessionId,
      userId: decoded.userId,
      refreshTokenHash,
      revokedAt: { $exists: false },
      expiresAt: { $gt: new Date() },
    });

    if (isValidInRedis !== refreshTokenHash || !session) {
      return res.status(401).json({ error: 'Unauthorized: Session expired or revoked' });
    }

    const user = await User.findById(decoded.userId);
    if (!user || user.status !== 'active') {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const tokens = await generateTokens(user.id, user.role, req, decoded.sessionId);
    setAuthCookies(res, tokens);

    res.json({ accessToken: tokens.accessToken, user: publicUser(user) });
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized: Invalid refresh token' });
  }
};

export const logout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];
    if (refreshToken) {
      try {
        const decoded = verifyRefreshToken(refreshToken);
        await revokeRefreshToken(decoded.userId, refreshToken);
      } catch (e) {
        // Ignore errors during logout (e.g., token already expired)
      }
    }

    clearAuthCookies(res);
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
};

// ── MFA Endpoints ──

export const setupMfa = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.mfaEnabled) {
      return res.status(400).json({ error: 'MFA is already enabled' });
    }

    const secret = otp.generateSecret();
    const otpauthUrl = otp.generateURI({
      issuer: 'Deltaora',
      label: user.email,
      secret,
    });
    
    // Save secret temporarily (not fully enabled until verified)
    user.mfaSecret = secret;
    await user.save();

    const qrCodeImage = await QRCode.toDataURL(otpauthUrl);

    res.json({ secret, qrCodeImage });
  } catch (error) {
    next(error);
  }
};

export const verifyMfa = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    const { code } = req.body;
    
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!user.mfaSecret) {
      return res.status(400).json({ error: 'MFA setup has not been initiated' });
    }

    const mfaResult = await otp.verify({ token: code, secret: user.mfaSecret });
    
    if (!mfaResult.valid) {
      return res.status(400).json({ error: 'Invalid authentication code' });
    }

    const { codes, hashes } = await generateRecoveryCodes();
    user.mfaEnabled = true;
    user.mfaRecoveryCodeHashes = hashes;
    await user.save();

    res.json({ message: 'MFA enabled successfully', recoveryCodes: codes });
  } catch (error) {
    next(error);
  }
};

// ── Account Recovery ──

export const forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;
    
    const user = await User.findOne({ email });
    if (!user) {
      // 2026 Standard: Do not leak whether an email exists or not
      return res.json({ message: RESET_MESSAGE });
    }

    const resetToken = randomToken(32);
    await PasswordResetToken.create({
      userId: user._id,
      tokenHash: sha256(resetToken),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });

    const resetUrl = `${env.CLIENT_URL}/reset-password?token=${resetToken}`;

    await sendEmail({
      to: user.email,
      subject: 'Deltaora — Reset Your Password',
      htmlContent: passwordResetEmail(resetUrl),
    });

    res.json({ message: RESET_MESSAGE });
  } catch (error) {
    next(error);
  }
};

export const resetPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token, newPassword } = req.body;

    const resetRecord = await PasswordResetToken.findOne({
      tokenHash: sha256(token),
      usedAt: { $exists: false },
      expiresAt: { $gt: new Date() },
    });

    if (!resetRecord) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    const user = await User.findById(resetRecord.userId);
    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    const passwordErrors = validatePasswordPolicy(newPassword, { email: user.email, name: user.name });
    if (passwordErrors.length > 0) {
      return res.status(400).json({ error: 'Password does not meet security requirements', details: passwordErrors });
    }

    user.passwordHash = newPassword;
    user.passwordChangedAt = new Date();
    user.failedLoginCount = 0;
    user.lockoutUntil = undefined;
    resetRecord.usedAt = new Date();
    await resetRecord.save();
    await user.save();
    await revokeAllUserSessions(user.id, 'password_reset');
    clearAuthCookies(res);

    res.json({ message: 'Password has been successfully reset. You may now log in.' });
  } catch (error) {
    next(error);
  }
};

// ── Email Verification ──

export const sendVerificationEmail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await User.findById(req.user?.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (user.isEmailVerified) {
      return res.status(400).json({ error: 'Email is already verified' });
    }

    const verificationToken = jwt.sign(
      { userId: user.id },
      env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    const verificationUrl = `${env.CLIENT_URL || 'http://localhost:5173'}/verify-email?token=${verificationToken}`;

    await sendEmail({
      to: user.email,
      subject: 'Deltaora — Verify Your Email',
      htmlContent: verificationEmail(verificationUrl),
    });

    res.json({ message: 'Verification email sent' });
  } catch (error) {
    next(error);
  }
};

export const verifyEmail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token is required' });

    let decoded: any;
    try {
      decoded = jwt.verify(token, env.JWT_SECRET);
    } catch (err) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    const user = await User.findById(decoded.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.isEmailVerified = true;
    await user.save();

    res.json({ message: 'Email verified successfully', user: { isEmailVerified: true } });
  } catch (error) {
    next(error);
  }
};

// ── Google OAuth ──

export const googleLogin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.body;
    
    // Verify the Google ID Token securely on the backend
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: env.GOOGLE_CLIENT_ID,
    });
    
    const payload = ticket.getPayload();
    if (!payload || !payload.email || !payload.email_verified) {
      return res.status(400).json({ error: 'Invalid Google token' });
    }

    const { email, name, sub: googleId } = payload;
    
    let user = await User.findOne({ email });
    let workspaceId;

    if (!user) {
      // Create new user (automatically verified since it's via Google)
      user = new User({
        name: name || 'User',
        email,
        googleId,
        isEmailVerified: true,
      });
      await user.save();

      // Provision personal workspace
      const workspace = new Workspace({
        name: `${user.name}'s Workspace`,
        ownerId: user._id,
        members: [{ userId: user._id, role: 'owner', joinedAt: new Date() }],
        plan: 'free',
        maxPages: 10,
      });
      await workspace.save();
      workspaceId = workspace.id;

      // Send welcome email (fire-and-forget)
      sendEmail({
        to: email,
        subject: 'Welcome to Deltaora!',
        htmlContent: welcomeEmail(user.name),
      }).catch(err => console.error('Failed to send welcome email:', err));
    } else {
      if (user.status !== 'active') {
        return res.status(403).json({ error: 'Account is not active' });
      }
      // Link Google ID if not already linked (e.g. user previously signed up with email)
      if (!user.googleId) {
        user.googleId = googleId;
        // Also verify their email if it wasn't already since Google confirmed it
        user.isEmailVerified = true;
        await user.save();
      }
    }

    user.lastLoginAt = new Date();
    await user.save();
    const tokens = await generateTokens(user.id, user.role, req);
    setAuthCookies(res, tokens);

    res.json({ 
      accessToken: tokens.accessToken,
      user: publicUser(user),
      workspaceId
    });
  } catch (error) {
    next(error);
  }
};
