// Auth routes. Declarative — wiring only.
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { loginSchema, refreshTokenSchema, registerSchema } from '@samagama/shared';
import { authController } from '../controllers/auth.controller.js';
import { validate } from '../middlewares/validate.js';
import { requireAuth } from '../middlewares/auth.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();

// Tighter limit on login to deter credential stuffing (PRD §19.2).
// Disabled in development/test so demo simulations don't lock out manual logins.
import { env } from '../config/env.js';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => !env.isProduction,
});

router.post('/register', validate(registerSchema), asyncHandler(authController.register));
router.post('/login', loginLimiter, validate(loginSchema), asyncHandler(authController.login));
router.post('/refresh', validate(refreshTokenSchema), asyncHandler(authController.refresh));
router.post('/logout', asyncHandler(authController.logout));
router.get('/me', requireAuth, asyncHandler(authController.me));

export const authRouter = router;
