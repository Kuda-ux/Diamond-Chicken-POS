import { Response } from 'express';
import { z } from 'zod';
import sql from '../db/client';
import { successResponse, errorResponse } from '../utils/response';
import { AuthRequest } from '../middleware/auth';

// GET /api/recipes — overview: every menu item + ingredient count
export async function listRecipesOverview(_req: AuthRequest, res: Response) {
  try {
    const rows = await sql`
      SELECT
        m.id AS "menuItemId",
        m.name,
        m.price::float AS price,
        c.name AS "categoryName",
        COUNT(r.id)::int AS "ingredientCount"
      FROM menu_items m
      LEFT JOIN categories c ON m.category_id = c.id
      LEFT JOIN recipes r ON r.menu_item_id = m.id
      GROUP BY m.id, c.name, c.sort_order, m.sort_order
      ORDER BY c.sort_order NULLS LAST, m.sort_order, m.name
    `;
    return successResponse(res, rows);
  } catch (error) {
    console.error('List recipes overview error:', error);
    return errorResponse(res, 'Failed to list recipes', 500);
  }
}

// GET /api/recipes/:menuItemId — full recipe for one menu item
export async function getRecipe(req: AuthRequest, res: Response) {
  try {
    const { menuItemId } = req.params;
    const rows = await sql`
      SELECT
        r.id,
        r.ingredient_id AS "ingredientId",
        i.name AS "ingredientName",
        i.unit,
        i.quantity::float AS "ingredientStock",
        i.unit_cost::float AS "unitCost",
        r.quantity_per_unit::float AS "quantityPerUnit"
      FROM recipes r
      JOIN ingredients i ON r.ingredient_id = i.id
      WHERE r.menu_item_id = ${menuItemId}
      ORDER BY i.name
    `;
    return successResponse(res, rows);
  } catch (error) {
    console.error('Get recipe error:', error);
    return errorResponse(res, 'Failed to load recipe', 500);
  }
}

// PUT /api/recipes/:menuItemId — replace recipe (full set of ingredients)
const setRecipeSchema = z.object({
  items: z.array(
    z.object({
      ingredientId: z.string().uuid(),
      quantityPerUnit: z.number().positive(),
    })
  ),
});

export async function setRecipe(req: AuthRequest, res: Response) {
  try {
    const { menuItemId } = req.params;
    const { items } = setRecipeSchema.parse(req.body);

    // Verify menu item exists
    const exists = await sql`SELECT 1 FROM menu_items WHERE id = ${menuItemId}`;
    if (exists.length === 0) return errorResponse(res, 'Menu item not found', 404);

    // Deduplicate ingredient ids on client side; reject if duplicates remain
    const seen = new Set<string>();
    for (const it of items) {
      if (seen.has(it.ingredientId)) {
        return errorResponse(res, 'Each ingredient may only appear once in a recipe', 400);
      }
      seen.add(it.ingredientId);
    }

    // Verify all ingredients exist and are active
    for (const it of items) {
      const ing = await sql`SELECT 1 FROM ingredients WHERE id = ${it.ingredientId} AND is_active = TRUE`;
      if (ing.length === 0) {
        return errorResponse(res, `Ingredient not found: ${it.ingredientId}`, 400);
      }
    }

    // Replace recipe: delete existing rows, insert new ones
    await sql`DELETE FROM recipes WHERE menu_item_id = ${menuItemId}`;
    for (const it of items) {
      await sql`
        INSERT INTO recipes (menu_item_id, ingredient_id, quantity_per_unit)
        VALUES (${menuItemId}, ${it.ingredientId}, ${it.quantityPerUnit})
      `;
    }

    const updated = await sql`
      SELECT
        r.id,
        r.ingredient_id AS "ingredientId",
        i.name AS "ingredientName",
        i.unit,
        r.quantity_per_unit::float AS "quantityPerUnit"
      FROM recipes r
      JOIN ingredients i ON r.ingredient_id = i.id
      WHERE r.menu_item_id = ${menuItemId}
      ORDER BY i.name
    `;
    return successResponse(res, updated, 'Recipe saved');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, 'Validation error', 400, error.errors);
    }
    console.error('Set recipe error:', error);
    return errorResponse(res, 'Failed to save recipe', 500);
  }
}
