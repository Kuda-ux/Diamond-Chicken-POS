import { Router } from 'express';
import * as statsController from '../controllers/statsController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.get('/dashboard', authenticate, authorize('admin', 'manager'), statsController.getDashboardStats);

export default router;
