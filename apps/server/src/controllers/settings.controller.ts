// Global system-settings HTTP layer (admin-configurable thresholds). Singleton document.
import type { Request, Response } from 'express';
import type { SettingsUpdateInput } from '@samagama/shared';
import { settingsService } from '../services/settings.service.js';
import { ok } from '../utils/api-response.js';

export const settingsController = {
  // Read the current global settings (creating defaults on first access).
  async get(_req: Request, res: Response) {
    return ok(res, await settingsService.get());
  },

  // Admin: patch one or more settings values. Body is validated by settingsUpdateSchema.
  async update(req: Request, res: Response) {
    return ok(res, await settingsService.update(req.body as SettingsUpdateInput));
  },
};
