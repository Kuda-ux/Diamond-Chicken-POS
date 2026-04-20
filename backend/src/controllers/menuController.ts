import { Response } from 'express';
import { z } from 'zod';
import sql from '../db/client';
import { successResponse, errorResponse } from '../utils/response';
import { AuthRequest } from '../middleware/auth';

const createMenuItemSchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().min(1).max(120),
  description: z.string().optional(),
  price: z.number().positive(),
  imageUrl: z.string().url().optional(),
  prepTimeMinutes: z.number().int().positive().optional(),
  sortOrder: z.number().int().optional(),
});

export async function getMenu(req: AuthRequest, res: Response) {
  try {
    const menu = await sql`
      SELECT 
        m.id,
        m.category_id as "categoryId",
        m.name,
        m.description,
        m.price,
        m.image_url as "imageUrl",
        m.is_available as "isAvailable",
        m.prep_time_minutes as "prepTimeMinutes",
        m.sort_order as "sortOrder",
        i.quantity as "stockQuantity",
        i.low_stock_threshold as "lowStockThreshold"
      FROM menu_items m
      LEFT JOIN inventory i ON m.id = i.menu_item_id
      ORDER BY m.category_id, m.sort_order ASC, m.name ASC
    `;

    return successResponse(res, menu);
  } catch (error) {
    return errorResponse(res, 'Failed to fetch menu', 500);
  }
}

export async function getMenuItem(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;

    const items = await sql`
      SELECT 
        m.id,
        m.category_id as "categoryId",
        m.name,
        m.description,
        m.price,
        m.image_url as "imageUrl",
        m.is_available as "isAvailable",
        m.prep_time_minutes as "prepTimeMinutes",
        m.sort_order as "sortOrder",
        i.quantity as "stockQuantity"
      FROM menu_items m
      LEFT JOIN inventory i ON m.id = i.menu_item_id
      WHERE m.id = ${id}
    `;

    if (items.length === 0) {
      return errorResponse(res, 'Menu item not found', 404);
    }

    return successResponse(res, items[0]);
  } catch (error) {
    return errorResponse(res, 'Failed to fetch menu item', 500);
  }
}

export async function createMenuItem(req: AuthRequest, res: Response) {
  try {
    const data = createMenuItemSchema.parse(req.body);

    const result = await sql`
      INSERT INTO menu_items (category_id, name, description, price, image_url, prep_time_minutes, sort_order)
      VALUES (
        ${data.categoryId},
        ${data.name},
        ${data.description || null},
        ${data.price},
        ${data.imageUrl || null},
        ${data.prepTimeMinutes || 5},
        ${data.sortOrder || 0}
      )
      RETURNING id, category_id as "categoryId", name, description, price, image_url as "imageUrl",
                is_available as "isAvailable", prep_time_minutes as "prepTimeMinutes", sort_order as "sortOrder"
    `;

    await sql`
      INSERT INTO inventory (menu_item_id, quantity, low_stock_threshold, unit)
      VALUES (${result[0].id}, 0, 10, 'pieces')
    `;

    return successResponse(res, result[0], 'Menu item created', 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, 'Validation error', 400, error.errors);
    }
    return errorResponse(res, 'Failed to create menu item', 500);
  }
}

export async function updateMenuItem(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const data = createMenuItemSchema.partial().parse(req.body);

    const result = await sql`
      UPDATE menu_items
      SET 
        category_id = COALESCE(${data.categoryId}, category_id),
        name = COALESCE(${data.name}, name),
        description = COALESCE(${data.description}, description),
        price = COALESCE(${data.price}, price),
        image_url = COALESCE(${data.imageUrl}, image_url),
        prep_time_minutes = COALESCE(${data.prepTimeMinutes}, prep_time_minutes),
        sort_order = COALESCE(${data.sortOrder}, sort_order)
      WHERE id = ${id}
      RETURNING id, category_id as "categoryId", name, description, price, image_url as "imageUrl",
                is_available as "isAvailable", prep_time_minutes as "prepTimeMinutes", sort_order as "sortOrder"
    `;

    if (result.length === 0) {
      return errorResponse(res, 'Menu item not found', 404);
    }

    return successResponse(res, result[0], 'Menu item updated');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, 'Validation error', 400, error.errors);
    }
    return errorResponse(res, 'Failed to update menu item', 500);
  }
}

export async function deleteMenuItem(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;

    await sql`DELETE FROM menu_items WHERE id = ${id}`;

    return successResponse(res, null, 'Menu item deleted');
  } catch (error) {
    return errorResponse(res, 'Failed to delete menu item', 500);
  }
}

export async function toggleAvailability(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;

    const result = await sql`
      UPDATE menu_items
      SET is_available = NOT is_available
      WHERE id = ${id}
      RETURNING id, is_available as "isAvailable"
    `;

    if (result.length === 0) {
      return errorResponse(res, 'Menu item not found', 404);
    }

    return successResponse(res, result[0], 'Availability toggled');
  } catch (error) {
    return errorResponse(res, 'Failed to toggle availability', 500);
  }
}
