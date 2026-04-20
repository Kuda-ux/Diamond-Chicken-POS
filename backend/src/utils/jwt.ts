import jwt from 'jsonwebtoken';
import { env } from './env';

export interface JWTPayload {
  userId: string;
  role: string;
  email?: string;
}

export function generateToken(payload: JWTPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });
}

export function verifyToken(token: string): JWTPayload {
  return jwt.verify(token, env.JWT_SECRET) as JWTPayload;
}
