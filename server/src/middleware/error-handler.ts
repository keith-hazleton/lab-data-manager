import type { Request, Response, NextFunction } from 'express';
import type { ApiResponse } from '@lab-data-manager/shared';

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.path} not found`,
  } satisfies ApiResponse<never>);
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('Error:', err);

  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
    } satisfies ApiResponse<never>);
    return;
  }

  // Handle SQLite constraint errors
  if (err.message.includes('UNIQUE constraint failed')) {
    res.status(409).json({
      success: false,
      error: 'A record with this identifier already exists',
    } satisfies ApiResponse<never>);
    return;
  }

  if (err.message.includes('FOREIGN KEY constraint failed')) {
    res.status(400).json({
      success: false,
      error: 'Referenced record does not exist',
    } satisfies ApiResponse<never>);
    return;
  }

  // Generic error
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message,
  } satisfies ApiResponse<never>);
}
