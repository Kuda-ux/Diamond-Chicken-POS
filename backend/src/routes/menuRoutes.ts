import { Router } from 'express';
import * as menuController from '../controllers/menuController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.get('/', menuController.getMenu);
router.get('/:id', menuController.getMenuItem);
router.post('/', authenticate, authorize('admin', 'manager'), menuController.createMenuItem);
router.put('/:id', authenticate, authorize('admin', 'manager'), menuController.updateMenuItem);
router.put('/:id/toggle', authenticate, authorize('admin', 'manager'), menuController.toggleAvailability);
router.delete('/:id', authenticate, authorize('admin'), menuController.deleteMenuItem);

export default router;
