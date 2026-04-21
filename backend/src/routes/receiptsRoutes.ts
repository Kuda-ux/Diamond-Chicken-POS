import { Router } from 'express';
import * as receiptsController from '../controllers/receiptsController';
import { authenticate } from '../middleware/auth';

const router = Router();

// Authenticated JSON endpoint — used by frontend printer service
router.get('/:id', authenticate, receiptsController.getReceiptData);

export default router;
