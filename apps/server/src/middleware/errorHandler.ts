import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { ForbiddenError } from '@casl/ability';

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);

  // CASL authorization errors (centralized handling)
  if (err instanceof ForbiddenError) {
    return res.status(403).json({
      error: 'Forbidden',
      message: err.message,
    });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation Error',
      details: err.errors,
    });
  }

  if (err.name === 'MongoServerError' && err.code === 11000) {
    return res.status(409).json({
      error: 'Conflict Error',
      message: 'Duplicate key error',
    });
  }

  const statusCode = err.statusCode || 500;

  // Suppress internal error details in production to prevent information disclosure
  const message = statusCode >= 500 && process.env.NODE_ENV === 'production'
    ? 'Internal Server Error'
    : err.message || 'Internal Server Error';

  res.status(statusCode).json({ error: message });
};
