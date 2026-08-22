import { Request, Response, NextFunction } from 'express';
import { User } from '../models/User';
import { Workspace } from '../models/Workspace';
import { PasswordResetToken } from '../models/PasswordResetToken';
import { EmailVerificationToken } from '../models/EmailVerificationToken';
import { PasskeyCredential } from '../models/PasskeyCredential';
import { UserSession } from '../models/UserSession';
import * as argon2 from 'argon2';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import {
  clearAuthCookies,
  generateTokens,
  markSessionReauthenticated,
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
import { logAuthEvent } from '../services/audit.service';
import { OTP } from 'otplib';
import QRCode from 'qrcode';
import { OAuth2Client } from 'google-auth-library';
import { validatePasswordPolicy } from '../services/passwordPolicy.service';
import {
  decryptSecret,
  encryptSecret,
  generateRecoveryCodes,
  randomToken,
  sha256,
  verifyRecoveryCode,
} from '../services/security.service';

const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);
const otp = new OTP();
const GENERIC_LOGIN_ERROR = 'Invalid email or password';
const GENERIC_REGISTER_MESSAGE = 'If this email can be used, a verification email has been sent.';
const RESET_MESSAGE = 'If an account exists with that email, a password reset link has been sent.';

const webAuthnOrigin = () => env.WEBAUTHN_ORIGIN || env.CLIENT_URL;
const webAuthnRpId = () => env.WEBAUTHN_RP_ID || new URL(webAuthnOrigin()).hostname;

const publicUser = (user: any) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  mfaEnabled: user.mfaEnabled,
  isEmailVerified: user.isEmailVerified,
});

const createEmailVerificationToken = async (userId: string) => {
  const token = randomToken(32);
  await EmailVerificationToken.create({
    userId,
    tokenHash: sha256(token),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });
  return token;
};

const sendVerificationLink = async (user: any) => {
  const token = await createEmailVerificationToken(user.id);
  const verificationUrl = `${env.CLIENT_URL || 'http://localhost:5173'}/verify-email?token=${token}`;

  await sendEmail({
    to: user.email,
    subject: 'Deltaora - Verify Your Email',
    htmlContent: verificationEmail(verificationUrl, env.CLIENT_URL),
  });
};

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

const verifyMfaChallenge = async (
  user: any,
  { mfaCode, recoveryCode }: { mfaCode?: string; recoveryCode?: string }
) => {
  if (!user.mfaEnabled || !user.mfaSecret) return false;

  const secret = decryptSecret(user.mfaSecret);
  const mfaResult = mfaCode
    ? await otp.verify({ token: mfaCode, secret })
    : { valid: false };
  const usedRecoveryHash = !mfaResult.valid && recoveryCode
    ? await verifyRecoveryCode(user.mfaRecoveryCodeHashes, recoveryCode)
    : null;

  if (usedRecoveryHash) {
    user.mfaRecoveryCodeHashes = user.mfaRecoveryCodeHashes.filter((hash: string) => hash !== usedRecoveryHash);
    await user.save();
  }

  return mfaResult.valid || !!usedRecoveryHash;
};

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, password } = req.body;

    const passwordErrors = await validatePasswordPolicy(password, { email, name });
    if (passwordErrors.length > 0) {
      return res.status(400).json({ error: 'Password does not meet security requirements', details: passwordErrors });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      await logAuthEvent('auth.register_existing_email', {
        actorId: existingUser.id,
        metadata: { email },
        req,
      });
      return res.status(202).json({ message: GENERIC_REGISTER_MESSAGE });
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

    const tokens = await generateTokens(user.id, user.role, req, undefined, { markReauthenticated: true });
    setAuthCookies(res, tokens);

    // 2026 Standard: Send welcome + verification email (fire-and-forget)
    sendVerificationLink(user).catch(err => console.error('Failed to send verification email:', err));
    await logAuthEvent('auth.registered', { actorId: user.id, req });

    res.status(201).json({ user: publicUser(user), workspaceId: workspace.id });
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, mfaCode, recoveryCode } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      await logAuthEvent('auth.login_failed', { metadata: { reason: 'unknown_email', email }, req });
      return res.status(401).json({ error: GENERIC_LOGIN_ERROR });
    }

    if (user.status !== 'active') {
      await logAuthEvent('auth.login_blocked', { actorId: user.id, metadata: { reason: user.status }, req });
      return res.status(403).json({ error: 'Account is not active' });
    }

    if (user.lockoutUntil && user.lockoutUntil > new Date()) {
      await logAuthEvent('auth.login_blocked', { actorId: user.id, metadata: { reason: 'locked' }, req });
      return res.status(429).json({ error: 'Account temporarily locked. Use password reset or try again later.' });
    }

    if (!user.passwordHash) {
      await logAuthEvent('auth.login_failed', { actorId: user.id, metadata: { reason: 'password_unavailable' }, req });
      return res.status(401).json({ error: 'Please sign in with Google or reset your password' });
    }

    const isValid = await argon2.verify(user.passwordHash, password);
    if (!isValid) {
      await recordFailedLogin(user);
      await logAuthEvent('auth.login_failed', {
        actorId: user.id,
        metadata: { reason: 'invalid_password', failedLoginCount: user.failedLoginCount },
        req,
      });
      return res.status(401).json({ error: GENERIC_LOGIN_ERROR });
    }

    if (user.mfaEnabled) {
      if (!mfaCode && !recoveryCode) {
        return res.status(401).json({ error: 'MFA_REQUIRED', message: 'Multi-factor authentication required' });
      }

      const mfaVerified = await verifyMfaChallenge(user, { mfaCode, recoveryCode });

      if (!mfaVerified) {
        await recordFailedLogin(user);
        await logAuthEvent('auth.login_failed', {
          actorId: user.id,
          metadata: { reason: 'invalid_mfa', failedLoginCount: user.failedLoginCount },
          req,
        });
        return res.status(401).json({ error: 'INVALID_MFA', message: 'Invalid authentication code' });
      }
    }

    await clearFailedLogins(user);
    const tokens = await generateTokens(user.id, user.role, req, undefined, {
      markReauthenticated: true,
      markMfaVerified: user.mfaEnabled,
    });
    setAuthCookies(res, tokens);
    await logAuthEvent('auth.login_success', { actorId: user.id, metadata: { mfa: user.mfaEnabled }, req });

    // Return default workspace on login
    const workspace = await Workspace.findOne({ 'members.userId': user._id });

    res.status(200).json({ 
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
      absoluteExpiresAt: { $gt: new Date() },
    });

    if (isValidInRedis !== refreshTokenHash || !session) {
      const suspiciousSession = await UserSession.findOne({
        _id: decoded.sessionId,
        userId: decoded.userId,
        revokedAt: { $exists: false },
      }).select('_id');

      if (suspiciousSession) {
        await revokeAllUserSessions(decoded.userId, 'refresh_token_reuse_detected');
        await logAuthEvent('auth.refresh_reuse_detected', {
          actorId: decoded.userId,
          metadata: { sessionId: decoded.sessionId },
          req,
        });
      }
      return res.status(401).json({ error: 'Unauthorized: Session expired or revoked' });
    }

    const user = await User.findById(decoded.userId);
    if (!user || user.status !== 'active') {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const tokens = await generateTokens(user.id, user.role, req, decoded.sessionId);
    setAuthCookies(res, tokens);

    res.json({ user: publicUser(user) });
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
        await logAuthEvent('auth.logout', { actorId: decoded.userId, req });
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
    user.mfaSecret = encryptSecret(secret);
    await user.save();
    await logAuthEvent('auth.mfa_setup_started', { actorId: user.id, req });

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

    const mfaResult = await otp.verify({ token: code, secret: decryptSecret(user.mfaSecret) });
    
    if (!mfaResult.valid) {
      return res.status(400).json({ error: 'Invalid authentication code' });
    }

    const { codes, hashes } = await generateRecoveryCodes();
    user.mfaEnabled = true;
    user.mfaRecoveryCodeHashes = hashes;
    await user.save();
    if (req.user?.sessionId) {
      await markSessionReauthenticated(user.id, req.user.sessionId, { mfaVerified: true });
    }

    await logAuthEvent('auth.mfa_enabled', { actorId: user.id, req });
    res.json({ message: 'MFA enabled successfully', recoveryCodes: codes });
  } catch (error) {
    next(error);
  }
};

export const stepUp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    const sessionId = req.user?.sessionId;
    const { currentPassword, mfaCode, recoveryCode } = req.body;

    if (!userId || !sessionId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await User.findById(userId);
    if (!user || user.status !== 'active') {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    let mfaVerified = false;
    if (user.mfaEnabled) {
      mfaVerified = await verifyMfaChallenge(user, { mfaCode, recoveryCode });
      if (!mfaVerified) {
        return res.status(401).json({ error: 'Invalid authentication code', code: 'INVALID_MFA' });
      }
    } else {
      if (!user.passwordHash || !currentPassword) {
        return res.status(400).json({
          error: 'Enable MFA or use a password-backed account to perform sensitive actions',
          code: 'STEP_UP_UNAVAILABLE',
        });
      }

      const isValid = await argon2.verify(user.passwordHash, currentPassword);
      if (!isValid) {
        return res.status(401).json({ error: 'Current password is incorrect', code: 'INVALID_PASSWORD' });
      }
    }

    await markSessionReauthenticated(user.id, sessionId, { mfaVerified });
    await logAuthEvent('auth.step_up_success', { actorId: user.id, metadata: { mfaVerified }, req });

    res.json({ message: 'Re-authentication successful', mfaVerified });
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
      htmlContent: passwordResetEmail(resetUrl, env.CLIENT_URL),
    });
    await logAuthEvent('auth.password_reset_requested', { actorId: user.id, req });

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

    const passwordErrors = await validatePasswordPolicy(newPassword, { email: user.email, name: user.name });
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
    await logAuthEvent('auth.password_reset_completed', { actorId: user.id, req });

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

    await sendVerificationLink(user);
    await logAuthEvent('auth.email_verification_sent', { actorId: user.id, req });

    res.json({ message: 'Verification email sent' });
  } catch (error) {
    next(error);
  }
};

export const verifyEmail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token is required' });

    const verificationRecord = await EmailVerificationToken.findOne({
      tokenHash: sha256(token),
      usedAt: { $exists: false },
      expiresAt: { $gt: new Date() },
    });

    if (!verificationRecord) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    const user = await User.findById(verificationRecord.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.isEmailVerified = true;
    verificationRecord.usedAt = new Date();
    await verificationRecord.save();
    await user.save();
    await logAuthEvent('auth.email_verified', { actorId: user.id, req });

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
        htmlContent: welcomeEmail(user.name, env.CLIENT_URL),
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
        await logAuthEvent('auth.google_linked', { actorId: user.id, req });
      }
    }

    user.lastLoginAt = new Date();
    await user.save();
    const tokens = await generateTokens(user.id, user.role, req, undefined, { markReauthenticated: true });
    setAuthCookies(res, tokens);
    await logAuthEvent('auth.google_login_success', { actorId: user.id, req });

    res.json({ 
      user: publicUser(user),
      workspaceId
    });
  } catch (error) {
    next(error);
  }
};

export const startPasskeyRegistration = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await User.findById(req.user?.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const existingCredentials = await PasskeyCredential.find({ userId: user._id });
    const options = await generateRegistrationOptions({
      rpName: 'Deltaora',
      rpID: webAuthnRpId(),
      userID: Buffer.from(user.id),
      userName: user.email,
      userDisplayName: user.name,
      attestationType: 'none',
      excludeCredentials: existingCredentials.map(credential => ({
        id: credential.credentialId,
        transports: credential.transports as any,
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'required',
      },
      timeout: 60_000,
    } as any);

    await redis.set(`webauthn:registration:${user.id}`, options.challenge, 'EX', 5 * 60);
    await logAuthEvent('auth.passkey_registration_started', { actorId: user.id, req });

    res.json(options);
  } catch (error) {
    next(error);
  }
};

export const verifyPasskeyRegistration = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await User.findById(req.user?.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const expectedChallenge = await redis.get(`webauthn:registration:${user.id}`);
    if (!expectedChallenge) {
      return res.status(400).json({ error: 'Passkey registration challenge expired' });
    }

    const verification = await verifyRegistrationResponse({
      response: req.body.credential,
      expectedChallenge,
      expectedOrigin: webAuthnOrigin(),
      expectedRPID: webAuthnRpId(),
      requireUserVerification: true,
    } as any);

    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({ error: 'Passkey registration failed' });
    }

    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo as any;
    await PasskeyCredential.create({
      userId: user._id,
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey),
      counter: credential.counter,
      deviceType: credentialDeviceType,
      backedUp: !!credentialBackedUp,
      transports: req.body.credential?.response?.transports || credential.transports || [],
      name: req.body.name,
    });

    await redis.del(`webauthn:registration:${user.id}`);
    await logAuthEvent('auth.passkey_registered', {
      actorId: user.id,
      metadata: { credentialId: credential.id },
      req,
    });

    res.status(201).json({ message: 'Passkey registered successfully' });
  } catch (error: any) {
    if (error?.code === 11000) {
      return res.status(409).json({ error: 'This passkey is already registered' });
    }
    next(error);
  }
};

export const startPasskeyAuthentication = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user || user.status !== 'active') {
      await logAuthEvent('auth.passkey_login_failed', { metadata: { reason: 'unknown_or_inactive', email }, req });
      return res.status(401).json({ error: GENERIC_LOGIN_ERROR });
    }

    const credentials = await PasskeyCredential.find({ userId: user._id });
    if (credentials.length === 0) {
      await logAuthEvent('auth.passkey_login_failed', { actorId: user.id, metadata: { reason: 'no_passkeys' }, req });
      return res.status(401).json({ error: 'No passkeys are registered for this account' });
    }

    const options = await generateAuthenticationOptions({
      rpID: webAuthnRpId(),
      allowCredentials: credentials.map(credential => ({
        id: credential.credentialId,
        transports: credential.transports as any,
      })),
      userVerification: 'required',
      timeout: 60_000,
    } as any);

    await Promise.all(credentials.map(credential =>
      redis.set(
        `webauthn:authentication:${credential.credentialId}`,
        JSON.stringify({ challenge: options.challenge, userId: user.id }),
        'EX',
        5 * 60
      )
    ));

    res.json(options);
  } catch (error) {
    next(error);
  }
};

export const verifyPasskeyAuthentication = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const credentialId = req.body.credential?.id;
    const credential = await PasskeyCredential.findOne({ credentialId });
    if (!credential) {
      await logAuthEvent('auth.passkey_login_failed', { metadata: { reason: 'unknown_credential' }, req });
      return res.status(401).json({ error: GENERIC_LOGIN_ERROR });
    }

    const challengeRecord = await redis.get(`webauthn:authentication:${credential.credentialId}`);
    if (!challengeRecord) {
      return res.status(400).json({ error: 'Passkey authentication challenge expired' });
    }

    const { challenge, userId } = JSON.parse(challengeRecord);
    const user = await User.findById(userId);
    if (!user || user.status !== 'active') {
      return res.status(401).json({ error: GENERIC_LOGIN_ERROR });
    }

    const verification = await verifyAuthenticationResponse({
      response: req.body.credential,
      expectedChallenge: challenge,
      expectedOrigin: webAuthnOrigin(),
      expectedRPID: webAuthnRpId(),
      credential: {
        id: credential.credentialId,
        publicKey: new Uint8Array(credential.publicKey),
        counter: credential.counter,
        transports: credential.transports as any,
      },
      requireUserVerification: true,
    } as any);

    if (!verification.verified || !verification.authenticationInfo) {
      await logAuthEvent('auth.passkey_login_failed', {
        actorId: user.id,
        metadata: { reason: 'verification_failed' },
        req,
      });
      return res.status(401).json({ error: GENERIC_LOGIN_ERROR });
    }

    credential.counter = (verification.authenticationInfo as any).newCounter;
    credential.lastUsedAt = new Date();
    await credential.save();
    await redis.del(`webauthn:authentication:${credential.credentialId}`);

    const tokens = await generateTokens(user.id, user.role, req, undefined, {
      markReauthenticated: true,
      markMfaVerified: true,
    });
    setAuthCookies(res, tokens);
    await logAuthEvent('auth.passkey_login_success', {
      actorId: user.id,
      metadata: { credentialId: credential.credentialId },
      req,
    });

    const workspace = await Workspace.findOne({ 'members.userId': user._id });
    res.json({
      user: publicUser(user),
      defaultWorkspaceId: workspace?.id,
    });
  } catch (error) {
    next(error);
  }
};
