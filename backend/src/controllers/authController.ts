import { Response } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import sql from '../db/client';
import { generateToken } from '../utils/jwt';
import { successResponse, errorResponse } from '../utils/response';
import { AuthRequest } from '../middleware/auth';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const pinLoginSchema = z.object({
  pin: z.string().length(4),
});

export async function login(req: AuthRequest, res: Response) {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const users = await sql`
      SELECT id, name, email, password_hash, role, is_active
      FROM users
      WHERE email = ${email}
    `;

    if (users.length === 0) {
      return errorResponse(res, 'Invalid credentials', 401);
    }

    const user = users[0];

    if (!user.is_active) {
      return errorResponse(res, 'Account is deactivated', 403);
    }

    if (!user.password_hash) {
      return errorResponse(res, 'Invalid credentials', 401);
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      return errorResponse(res, 'Invalid credentials', 401);
    }

    const token = generateToken({
      userId: user.id,
      role: user.role,
      email: user.email,
    });

    return successResponse(res, {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    }, 'Login successful');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, 'Validation error', 400, error.errors);
    }
    return errorResponse(res, 'Login failed', 500);
  }
}

export async function pinLogin(req: AuthRequest, res: Response) {
  try {
    const { pin } = pinLoginSchema.parse(req.body);

    const users = await sql`
      SELECT id, name, role, pin, is_active
      FROM users
      WHERE role IN ('cashier', 'kitchen') AND pin IS NOT NULL AND is_active = true
    `;

    if (users.length === 0) {
      return errorResponse(res, 'Invalid PIN', 401);
    }

    let matchedUser = null;

    for (const user of users) {
      const isValidPin = await bcrypt.compare(pin, user.pin);
      if (isValidPin) {
        matchedUser = user;
        break;
      }
    }

    if (!matchedUser) {
      return errorResponse(res, 'Invalid PIN', 401);
    }

    if (!matchedUser.is_active) {
      return errorResponse(res, 'Account is deactivated', 403);
    }

    const token = generateToken({
      userId: matchedUser.id,
      role: matchedUser.role,
    });

    return successResponse(res, {
      token,
      user: {
        id: matchedUser.id,
        name: matchedUser.name,
        role: matchedUser.role,
      },
    }, 'Login successful');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, 'Validation error', 400, error.errors);
    }
    return errorResponse(res, 'Login failed', 500);
  }
}

export async function getMe(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return errorResponse(res, 'Unauthorized', 401);
    }

    const users = await sql`
      SELECT id, name, email, role, is_active, created_at
      FROM users
      WHERE id = ${req.user.userId}
    `;

    if (users.length === 0) {
      return errorResponse(res, 'User not found', 404);
    }

    return successResponse(res, users[0]);
  } catch (error) {
    return errorResponse(res, 'Failed to fetch user', 500);
  }
}

export async function logout(req: AuthRequest, res: Response) {
  return successResponse(res, null, 'Logged out successfully');
}
