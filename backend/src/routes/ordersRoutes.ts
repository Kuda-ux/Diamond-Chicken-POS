import { Router } from 'express';
import * as ordersController from '../controllers/ordersController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, ordersController.getOrders);
router.get('/today/summary', authenticate, ordersController.getTodaySummary);
router.get('/:id', authenticate, ordersController.getOrder);
router.post('/', authenticate, authorize('admin', 'manager', 'cashier'), ordersController.createOrder);
router.put('/:id/status', authenticate, ordersController.updateOrderStatus);
router.put('/:id/cancel', authenticate, ordersController.cancelOrder);
router.delete('/:id', authenticate, authorize('admin', 'manager'), ordersController.deleteOrder);

export default router;
