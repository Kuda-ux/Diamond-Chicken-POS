import { Router } from 'express';
import * as paymentsController from '../controllers/paymentsController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.post('/cash', authenticate, paymentsController.processCash);
router.post('/ecocash', authenticate, paymentsController.processEcocash);
router.post('/innbucks', authenticate, paymentsController.processInnbucks);
router.post('/zipit', authenticate, paymentsController.processZipit);
router.post('/card', authenticate, paymentsController.processCard);
router.get('/:orderId/status', authenticate, paymentsController.getPaymentStatus);
router.post('/confirm', authenticate, authorize('admin', 'manager', 'cashier'), paymentsController.confirmPayment);

export default router;
