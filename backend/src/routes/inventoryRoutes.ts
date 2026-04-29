import { Router } from 'express';
import * as inventoryController from '../controllers/inventoryController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, authorize('admin', 'manager'), inventoryController.listInventory);
router.post('/:menuItemId/restock', authenticate, authorize('admin', 'manager'), inventoryController.restockItem);

// Stock receipts (weekly batches)
router.get('/receipts/summary', authenticate, authorize('admin', 'manager'), inventoryController.stockReceiptsSummary);
router.get('/receipts', authenticate, authorize('admin', 'manager'), inventoryController.listStockReceipts);
router.post('/receipts', authenticate, authorize('admin', 'manager'), inventoryController.createStockReceipts);
router.delete('/receipts/:id', authenticate, authorize('admin'), inventoryController.deleteStockReceipt);

export default router;
