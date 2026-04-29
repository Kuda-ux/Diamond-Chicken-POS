import { Router } from 'express';
import * as usersController from '../controllers/usersController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, authorize('admin'), usersController.listUsers);
router.post('/', authenticate, authorize('admin'), usersController.createUser);
router.patch('/:id', authenticate, authorize('admin'), usersController.updateUser);
router.delete('/:id', authenticate, authorize('admin'), usersController.deleteUser);

export default router;
