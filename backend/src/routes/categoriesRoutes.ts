import { Router } from 'express';
import * as categoriesController from '../controllers/categoriesController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.get('/', categoriesController.getCategories);
router.post('/', authenticate, authorize('admin', 'manager'), categoriesController.createCategory);
router.put('/reorder', authenticate, authorize('admin', 'manager'), categoriesController.reorderCategories);
router.put('/:id', authenticate, authorize('admin', 'manager'), categoriesController.updateCategory);
router.delete('/:id', authenticate, authorize('admin'), categoriesController.deleteCategory);

export default router;
