import { Router } from 'express';
import * as shiftsController from '../controllers/shiftsController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.get('/current', authenticate, authorize('admin', 'manager', 'cashier'), shiftsController.getCurrentShift);
router.post('/open', authenticate, authorize('admin', 'manager', 'cashier'), shiftsController.openShift);
router.post('/close', authenticate, authorize('admin', 'manager', 'cashier'), shiftsController.closeShift);
router.get('/:id/z-report', authenticate, authorize('admin', 'manager', 'cashier'), shiftsController.getZReport);

export default router;
