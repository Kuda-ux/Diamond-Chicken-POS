import { Router } from 'express';
import * as statsController from '../controllers/statsController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.get('/dashboard', authenticate, authorize('admin', 'manager'), statsController.getDashboardStats);
router.get('/daily-report', authenticate, authorize('admin', 'manager'), statsController.getDailyReport);

export default router;
