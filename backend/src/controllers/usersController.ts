import { Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import sql from '../db/client';
import { successResponse, errorResponse } from '../utils/response';
import { AuthRequest } from '../middleware/auth';

const ROLES = ['admin', 'manager', 'cashier', 'kitchen'] as const;

// GET /api/users — list all users
export async function listUsers(_req: AuthRequest, res: Response) {
  try {
    const rows = await sql`
      SELECT id, name, email, role, is_active AS "isActive",
             pin IS NOT NULL AS "hasPin",
             password_hash IS NOT NULL AS "hasPassword",
             created_at AS "createdAt", updated_at AS "updatedAt"
      FROM users
      ORDER BY
        CASE role
          WHEN 'admin' THEN 1
          WHEN 'manager' THEN 2
          WHEN 'cashier' THEN 3
          WHEN 'kitchen' THEN 4
          ELSE 5
        END,
        name ASC
    `;
    return successResponse(res, rows);
  } catch (error) {
    console.error('List users error:', error);
    return errorResponse(res, 'Failed to list users', 500);
  }
}

const createUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().optional().or(z.literal('').transform(() => undefined)),
  role: z.enum(ROLES),
  password: z.string().min(6).optional(),
  pin: z.string().regex(/^\d{4}$/).optional(),
}).refine((d) => {
  if (d.role === 'admin' || d.role === 'manager') return !!d.password && !!d.email;
  if (d.role === 'cashier' || d.role === 'kitchen') return !!d.pin;
  return false;
}, { message: 'Admin/manager need email + password (min 6); cashier/kitchen need a 4-digit PIN' });

// POST /api/users — create
export async function createUser(req: AuthRequest, res: Response) {
  try {
    const data = createUserSchema.parse(req.body);

    // Email uniqueness
    if (data.email) {
      const existing = await sql`SELECT 1 FROM users WHERE email = ${data.email}`;
      if (existing.length > 0) {
        return errorResponse(res, 'Email already in use', 409);
      }
    }

    // PIN uniqueness check (4-digit PINs are limited; we must avoid clashes)
    if (data.pin) {
      const candidates = await sql`
        SELECT pin FROM users WHERE pin IS NOT NULL AND role IN ('cashier','kitchen') AND is_active = true
      `;
      for (const u of candidates) {
        if (await bcrypt.compare(data.pin, u.pin)) {
          return errorResponse(res, 'PIN is already in use, please choose another', 409);
        }
      }
    }

    const passwordHash = data.password ? await bcrypt.hash(data.password, 12) : null;
    const pinHash = data.pin ? await bcrypt.hash(data.pin, 10) : null;

    const [user] = await sql`
      INSERT INTO users (name, email, password_hash, role, pin)
      VALUES (${data.name}, ${data.email || null}, ${passwordHash}, ${data.role}, ${pinHash})
      RETURNING id, name, email, role, is_active AS "isActive"
    `;
    return successResponse(res, user, 'User created');
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      const msg = error.errors[0]?.message || 'Validation error';
      return errorResponse(res, msg, 400, error.errors);
    }
    console.error('Create user error:', error);
    return errorResponse(res, 'Failed to create user', 500);
  }
}

const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional().or(z.literal('').transform(() => undefined)),
  role: z.enum(ROLES).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(6).optional(),
  pin: z.string().regex(/^\d{4}$/).optional().or(z.literal('').transform(() => undefined)),
});

// PATCH /api/users/:id — update
export async function updateUser(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const data = updateUserSchema.parse(req.body);

    const [target] = await sql`SELECT id, role, is_active FROM users WHERE id = ${id}`;
    if (!target) return errorResponse(res, 'User not found', 404);

    // Self-protection: can't deactivate or demote yourself
    if (req.user?.userId === id) {
      if (data.isActive === false) return errorResponse(res, 'You cannot deactivate your own account', 400);
      if (data.role && data.role !== target.role) return errorResponse(res, 'You cannot change your own role', 400);
    }

    // Don't leave the system without an active admin
    if ((data.role && data.role !== 'admin' && target.role === 'admin') ||
        (data.isActive === false && target.role === 'admin')) {
      const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM users WHERE role = 'admin' AND is_active = true AND id != ${id}`;
      if (count === 0) {
        return errorResponse(res, 'At least one active admin is required', 400);
      }
    }

    if (data.email) {
      const dup = await sql`SELECT 1 FROM users WHERE email = ${data.email} AND id != ${id}`;
      if (dup.length > 0) return errorResponse(res, 'Email already in use', 409);
    }

    if (data.pin) {
      const candidates = await sql`
        SELECT id, pin FROM users WHERE pin IS NOT NULL AND role IN ('cashier','kitchen') AND is_active = true AND id != ${id}
      `;
      for (const u of candidates) {
        if (await bcrypt.compare(data.pin, u.pin)) {
          return errorResponse(res, 'PIN is already in use, please choose another', 409);
        }
      }
    }

    const passwordHash = data.password ? await bcrypt.hash(data.password, 12) : null;
    const pinHash = data.pin ? await bcrypt.hash(data.pin, 10) : null;

    await sql`
      UPDATE users SET
        name = COALESCE(${data.name ?? null}, name),
        email = COALESCE(${data.email ?? null}, email),
        role = COALESCE(${data.role ?? null}, role),
        is_active = COALESCE(${data.isActive ?? null}, is_active),
        password_hash = COALESCE(${passwordHash}, password_hash),
        pin = COALESCE(${pinHash}, pin),
        updated_at = now()
      WHERE id = ${id}
    `;

    const [user] = await sql`
      SELECT id, name, email, role, is_active AS "isActive",
             pin IS NOT NULL AS "hasPin", password_hash IS NOT NULL AS "hasPassword"
      FROM users WHERE id = ${id}
    `;
    return successResponse(res, user, 'User updated');
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, error.errors[0]?.message || 'Validation error', 400, error.errors);
    }
    console.error('Update user error:', error);
    return errorResponse(res, 'Failed to update user', 500);
  }
}

// DELETE /api/users/:id — soft delete (deactivate). Admin only.
export async function deleteUser(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    if (req.user?.userId === id) {
      return errorResponse(res, 'You cannot delete your own account', 400);
    }
    const [target] = await sql`SELECT id, role FROM users WHERE id = ${id}`;
    if (!target) return errorResponse(res, 'User not found', 404);

    if (target.role === 'admin') {
      const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM users WHERE role = 'admin' AND is_active = true AND id != ${id}`;
      if (count === 0) {
        return errorResponse(res, 'At least one active admin is required', 400);
      }
    }

    // Soft delete: keep data integrity (orders/receipts FK), just deactivate.
    await sql`UPDATE users SET is_active = false, updated_at = now() WHERE id = ${id}`;
    return successResponse(res, null, 'User deactivated');
  } catch (error) {
    console.error('Delete user error:', error);
    return errorResponse(res, 'Failed to delete user', 500);
  }
}
