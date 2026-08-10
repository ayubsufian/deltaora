import { Request, Response, NextFunction } from 'express';
import { User } from '../models/User';
import { Workspace } from '../models/Workspace';
import * as argon2 from 'argon2';
import { generateTokens, revokeRefreshToken, verifyRefreshToken } from '../services/auth.service';
import { redis } from '../config/redis';
import { OTP } from 'otplib';
import QRCode from 'qrcode';

const otp = new OTP();

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, password } = req.body;

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

    const { accessToken, refreshToken } = await generateTokens(user.id, user.role);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(201).json({ accessToken, user: { id: user.id, name: user.name, email: user.email, role: user.role, mfaEnabled: user.mfaEnabled }, workspaceId: workspace.id });
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, mfaCode } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isValid = await argon2.verify(user.passwordHash, password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // 2026 Standard MFA flow
    if (user.mfaEnabled) {
      if (!mfaCode) {
        // Return 401 with specific flag to prompt frontend for MFA code
        return res.status(401).json({ error: 'MFA_REQUIRED', message: 'Multi-factor authentication required' });
      }

      const mfaResult = await otp.verify({ token: mfaCode, secret: user.mfaSecret! });
      if (!mfaResult.valid) {
        return res.status(401).json({ error: 'INVALID_MFA', message: 'Invalid authentication code' });
      }
    }

    const { accessToken, refreshToken } = await generateTokens(user.id, user.role);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // Return default workspace on login
    const workspace = await Workspace.findOne({ 'members.userId': user._id });

    res.status(200).json({ 
      accessToken, 
      user: { id: user.id, name: user.name, email: user.email, role: user.role, mfaEnabled: user.mfaEnabled },
      defaultWorkspaceId: workspace?.id
    });
  } catch (error) {
    next(error);
  }
};

export const refresh = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.cookies;
    if (!refreshToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const decoded = verifyRefreshToken(refreshToken);
    
    // Check Redis whitelist
    const isValidInRedis = await redis.get(`refresh_token:${decoded.userId}:${refreshToken}`);
    if (!isValidInRedis) {
      return res.status(401).json({ error: 'Unauthorized: Session expired or revoked' });
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Revoke old token and generate new ones (Rotation)
    await revokeRefreshToken(user.id, refreshToken);
    const { accessToken, refreshToken: newRefreshToken } = await generateTokens(user.id, user.role);

    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ accessToken });
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized: Invalid refresh token' });
  }
};

export const logout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.cookies;
    if (refreshToken) {
      try {
        const decoded = verifyRefreshToken(refreshToken);
        await revokeRefreshToken(decoded.userId, refreshToken);
      } catch (e) {
        // Ignore errors during logout (e.g., token already expired)
      }
    }

    res.clearCookie('refreshToken');
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

    user.mfaEnabled = true;
    await user.save();

    res.json({ message: 'MFA enabled successfully' });
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
      return res.json({ message: 'If an account exists with that email, a password reset link has been sent.' });
    }

    // Import here to avoid circular dependency if email.service imports env early, or just use it directly
    const { sendEmail } = require('../services/email.service');
    const jwt = require('jsonwebtoken');
    const { env } = require('../config/env');

    // Generate a secure, short-lived (15 min) JWT token for reset
    const resetToken = jwt.sign(
      { userId: user.id },
      env.JWT_SECRET + user.passwordHash, // Use current passwordHash in secret so token invalidates after use
      { expiresIn: '15m' }
    );

    const resetUrl = `http://localhost:5173/reset-password?token=${resetToken}&id=${user.id}`;

    const htmlContent = `
      <h1>Password Reset Request</h1>
      <p>We received a request to reset your password for your Deltaora account.</p>
      <p>Click the link below to reset your password. This link is valid for 15 minutes.</p>
      <a href="${resetUrl}" style="padding: 10px 20px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 5px;">Reset Password</a>
      <p>If you did not request this, please ignore this email.</p>
    `;

    await sendEmail({
      to: user.email,
      subject: 'Deltaora Password Reset',
      htmlContent,
    });

    res.json({ message: 'If an account exists with that email, a password reset link has been sent.' });
  } catch (error) {
    next(error);
  }
};

export const resetPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, token, newPassword } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    const jwt = require('jsonwebtoken');
    const { env } = require('../config/env');

    try {
      // Verify token using the secret combined with the CURRENT password hash
      jwt.verify(token, env.JWT_SECRET + user.passwordHash);
    } catch (err) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    // Token is valid, update password
    const argon2 = require('argon2');
    user.passwordHash = await argon2.hash(newPassword);
    
    // Invalidate all existing sessions for security
    const { redis } = require('../config/redis');
    const keys = await redis.keys(`refresh_token:${user.id}:*`);
    if (keys.length > 0) {
      await redis.del(keys);
    }

    await user.save();

    res.json({ message: 'Password has been successfully reset. You may now log in.' });
  } catch (error) {
    next(error);
  }
};
