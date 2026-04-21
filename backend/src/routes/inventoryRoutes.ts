import { Router } from 'express';
import * as inventoryController from '../controllers/inventoryController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, authorize('admin', 'manager'), inventoryController.listInventory);
router.post('/:menuItemId/restock', authenticate, authorize('admin', 'manager'), inventoryController.restockItem);

export default router;
