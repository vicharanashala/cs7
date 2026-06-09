// Standard envelope helpers, kept thin so controllers stay readable.
import type { Response } from 'express';
import type { ApiMeta } from '@samagama/shared';

export function ok<T>(res: Response, data: T, meta?: ApiMeta): Response {
  return res.status(200).json({ success: true, data, ...(meta ? { meta } : {}) });
}

export function created<T>(res: Response, data: T): Response {
  return res.status(201).json({ success: true, data });
}

export function noContent(res: Response): Response {
  return res.status(204).send();
}
