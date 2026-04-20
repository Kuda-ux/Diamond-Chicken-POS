import { Response } from 'express';
import { z } from 'zod';
import sql from '../db/client';
import { successResponse, errorResponse } from '../utils/response';
import { AuthRequest } from '../middleware/auth';

const createCategorySchema = z.object({
  name: z.string().min(1).max(80),
  icon: z.string().max(10).optional(),
  sortOrder: z.number().int().optional(),
});

export async function getCategories(req: AuthRequest, res: Response) {
  try {
    const categories = await sql`
      SELECT id, name, icon, sort_order as "sortOrder", is_active as "isActive"
      FROM categories
      WHERE is_active = true
      ORDER BY sort_order ASC, name ASC
    `;

    return successResponse(res, categories);
  } catch (error) {
    return errorResponse(res, 'Failed to fetch categories', 500);
  }
}

export async function createCategory(req: AuthRequest, res: Response) {
  try {
    const data = createCategorySchema.parse(req.body);

    const result = await sql`
      INSERT INTO categories (name, icon, sort_order)
      VALUES (${data.name}, ${data.icon || null}, ${data.sortOrder || 0})
      RETURNING id, name, icon, sort_order as "sortOrder", is_active as "isActive"
    `;

    return successResponse(res, result[0], 'Category created', 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, 'Validation error', 400, error.errors);
    }
    return errorResponse(res, 'Failed to create category', 500);
  }
}

export async function updateCategory(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const data = createCategorySchema.partial().parse(req.body);

    const result = await sql`
      UPDATE categories
      SET 
        name = COALESCE(${data.name}, name),
        icon = COALESCE(${data.icon}, icon),
        sort_order = COALESCE(${data.sortOrder}, sort_order)
      WHERE id = ${id}
      RETURNING id, name, icon, sort_order as "sortOrder", is_active as "isActive"
    `;

    if (result.length === 0) {
      return errorResponse(res, 'Category not found', 404);
    }

    return successResponse(res, result[0], 'Category updated');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, 'Validation error', 400, error.errors);
    }
    return errorResponse(res, 'Failed to update category', 500);
  }
}

export async function deleteCategory(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;

    const result = await sql`
      UPDATE categories
      SET is_active = false
      WHERE id = ${id}
      RETURNING id
    `;

    if (result.length === 0) {
      return errorResponse(res, 'Category not found', 404);
    }

    return successResponse(res, null, 'Category deleted');
  } catch (error) {
    return errorResponse(res, 'Failed to delete category', 500);
  }
}

export async function reorderCategories(req: AuthRequest, res: Response) {
  try {
    const { categories } = req.body as { categories: Array<{ id: string; sortOrder: number }> };

    for (const cat of categories) {
      await sql`
        UPDATE categories
        SET sort_order = ${cat.sortOrder}
        WHERE id = ${cat.id}
      `;
    }

    return successResponse(res, null, 'Categories reordered');
  } catch (error) {
    return errorResponse(res, 'Failed to reorder categories', 500);
  }
}
