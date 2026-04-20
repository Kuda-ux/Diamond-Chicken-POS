import { Request, Response, NextFunction } from 'express';
import { errorResponse } from '../utils/response';

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  console.error('Error:', err);

  if (err.name === 'ValidationError') {
    return errorResponse(res, 'Validation error', 400, err.errors);
  }

  if (err.name === 'UnauthorizedError') {
    return errorResponse(res, 'Unauthorized', 401);
  }

  return errorResponse(res, err.message || 'Internal server error', err.statusCode || 500);
}
