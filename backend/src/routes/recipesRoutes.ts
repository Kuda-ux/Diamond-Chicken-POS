import { Router } from 'express';
import * as recipesController from '../controllers/recipesController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, authorize('admin', 'manager'), recipesController.listRecipesOverview);
router.get('/:menuItemId', authenticate, authorize('admin', 'manager'), recipesController.getRecipe);
router.put('/:menuItemId', authenticate, authorize('admin', 'manager'), recipesController.setRecipe);

export default router;
