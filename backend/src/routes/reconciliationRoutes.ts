import { Router } from 'express';
import * as reconciliationController from '../controllers/reconciliationController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, authorize('admin', 'manager'), reconciliationController.getReconciliation);
router.post('/count', authenticate, authorize('admin', 'manager'), reconciliationController.recordStockCount);
router.get('/counts', authenticate, authorize('admin', 'manager'), reconciliationController.getStockCounts);

export default router;
