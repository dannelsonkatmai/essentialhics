import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // Log full error server-side — never send stack traces to the client
  logger.error('Unhandled error', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // Check for known error types
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    res.status(401).json({ message: 'Invalid or expired token.' });
    return;
  }

  // Default: generic 500 — never leak internals
  res.status(500).json({ message: 'An internal server error occurred.' });
}

export function notFound(req: Request, res: Response): void {
  res.status(404).json({ message: `Route ${req.method} ${req.path} not found.` });
}
