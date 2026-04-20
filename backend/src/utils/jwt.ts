import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from './env';

export interface JWTPayload {
  userId: string;
  role: string;
  email?: string;
}

export function generateToken(payload: JWTPayload): string {
  const options: SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
  };
  return jwt.sign(payload, env.JWT_SECRET, options);
}

export function verifyToken(token: string): JWTPayload {
  return jwt.verify(token, env.JWT_SECRET) as JWTPayload;
}
