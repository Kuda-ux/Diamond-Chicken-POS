import { Router } from 'express';
import * as ingredientsController from '../controllers/ingredientsController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, authorize('admin', 'manager'), ingredientsController.listIngredients);
router.post('/', authenticate, authorize('admin', 'manager'), ingredientsController.createIngredient);
router.patch('/:id', authenticate, authorize('admin', 'manager'), ingredientsController.updateIngredient);
router.delete('/:id', authenticate, authorize('admin'), ingredientsController.deleteIngredient);
router.post('/:id/restock', authenticate, authorize('admin', 'manager'), ingredientsController.restockIngredient);

// Ingredient receipts (delivery audit trail)
router.get('/receipts', authenticate, authorize('admin', 'manager'), ingredientsController.listIngredientReceipts);
router.post('/receipts', authenticate, authorize('admin', 'manager'), ingredientsController.createIngredientReceipts);
router.delete('/receipts/:id', authenticate, authorize('admin'), ingredientsController.deleteIngredientReceipt);

export default router;
