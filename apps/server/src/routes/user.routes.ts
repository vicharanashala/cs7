// User management routes — admin only.
import { Router } from 'express';
import { changeRoleSchema } from '@samagama/shared';
import { userController } from '../controllers/user.controller.js';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();

router.use(requireAuth, requireRole('admin'));

router.get('/', asyncHandler(userController.list));
router.patch('/:id/role', validate(changeRoleSchema), asyncHandler(userController.changeRole));
router.patch('/:id/suspend', asyncHandler(userController.suspend));
router.patch('/:id/activate', asyncHandler(userController.activate));
router.delete('/:id', asyncHandler(userController.deleteUser));

export const userRouter = router;
