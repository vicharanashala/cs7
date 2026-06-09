// Thin auth controller. Maps HTTP -> service. Keeps no business logic.
import type { Request, Response } from 'express';
import type { LoginInput, RegisterInput, RefreshTokenInput } from '@samagama/shared';
import { authService } from '../services/auth.service.js';
import { created, ok } from '../utils/api-response.js';
import { ApiError } from '../utils/api-error.js';

export const authController = {
  async register(req: Request, res: Response) {
    const input = req.body as RegisterInput;
    // Open registration is permitted for the student role only.
    // If a `role` was supplied, only an authenticated admin may set it.
    const result = await authService.register(input, req.user?.role);
    return created(res, result);
  },

  async login(req: Request, res: Response) {
    const input = req.body as LoginInput;
    const result = await authService.login(input);
    return ok(res, result);
  },

  async refresh(req: Request, res: Response) {
    const input = req.body as RefreshTokenInput;
    const result = await authService.refresh(input.refreshToken);
    return ok(res, result);
  },

  async me(req: Request, res: Response) {
    if (!req.user) throw ApiError.unauthorized();
    const result = await authService.getProfile(req.user.id);
    return ok(res, result);
  },

  async logout(_req: Request, res: Response) {
    // Stateless JWT logout is a client-side token discard. For refresh-token revocation,
    // bumping `tokenVersion` is the supported path (handled on password change).
    return ok(res, { message: 'Logged out' });
  },
};
