import { Router } from 'express';
import authRoutes from './authRoutes';
import categoriesRoutes from './categoriesRoutes';
import menuRoutes from './menuRoutes';
import ordersRoutes from './ordersRoutes';
import paymentsRoutes from './paymentsRoutes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/categories', categoriesRoutes);
router.use('/menu', menuRoutes);
router.use('/orders', ordersRoutes);
router.use('/payments', paymentsRoutes);

export default router;
