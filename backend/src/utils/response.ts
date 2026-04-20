import { Response } from 'express';

export function successResponse<T>(res: Response, data: T, message = 'Success', statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    data,
    message,
  });
}

export function errorResponse(res: Response, message: string, statusCode = 400, errors?: any[]) {
  return res.status(statusCode).json({
    success: false,
    message,
    errors,
  });
}
