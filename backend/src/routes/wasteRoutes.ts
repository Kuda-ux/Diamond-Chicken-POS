import { Router } from 'express';
import * as wasteController from '../controllers/wasteController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, authorize('admin', 'manager'), wasteController.listWaste);
router.get('/daily', authenticate, authorize('admin', 'manager'), wasteController.dailyWasteSummary);
router.post('/', authenticate, authorize('admin', 'manager'), wasteController.recordWaste);
router.delete('/:id', authenticate, authorize('admin'), wasteController.deleteWaste);

export default router;
