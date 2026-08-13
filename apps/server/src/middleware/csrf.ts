import { Request, Response, NextFunction } from 'express';
import { CSRF_COOKIE, setCsrfCookie } from '../services/auth.service';
import { verifyCsrfToken } from '../services/security.service';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export const issueCsrfToken = (_req: Request, res: Response) => {
  const csrfToken = setCsrfCookie(res);
  res.json({ csrfToken });
};

export const csrfProtection = (req: Request, res: Response, next: NextFunction) => {
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  const csrfHeader = req.headers['x-csrf-token'];
  const csrfToken = Array.isArray(csrfHeader) ? csrfHeader[0] : csrfHeader;
  const csrfCookie = req.cookies?.[CSRF_COOKIE];

  if (!verifyCsrfToken(csrfToken, csrfCookie)) {
    return res.status(403).json({
      error: 'CSRF validation failed',
      code: 'CSRF_REQUIRED',
    });
  }

  next();
};
