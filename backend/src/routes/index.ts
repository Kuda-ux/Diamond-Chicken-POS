import { Router } from 'express';
import authRoutes from './authRoutes';
import categoriesRoutes from './categoriesRoutes';
import menuRoutes from './menuRoutes';
import ordersRoutes from './ordersRoutes';
import paymentsRoutes from './paymentsRoutes';
import receiptsRoutes from './receiptsRoutes';
import statsRoutes from './statsRoutes';
import inventoryRoutes from './inventoryRoutes';
import shiftsRoutes from './shiftsRoutes';
import usersRoutes from './usersRoutes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/categories', categoriesRoutes);
router.use('/menu', menuRoutes);
router.use('/orders', ordersRoutes);
router.use('/payments', paymentsRoutes);
router.use('/receipts', receiptsRoutes);
router.use('/stats', statsRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/users', usersRoutes);
router.use('/shifts', shiftsRoutes);

export default router;
