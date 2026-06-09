// Help-center HTTP layer. Serves the bundle the client's in-browser search worker indexes.
import type { Request, Response } from 'express';
import { helpService } from '../services/help.service.js';

export const helpController = {
  // Export all searchable help docs as a single cacheable bundle. ETag + Cache-Control
  // let the client skip re-downloading when its copy is still current (304 Not Modified).
  async exportSearchData(req: Request, res: Response) {
    const { docs, etag } = await helpService.exportForSearch();

    // Return 304 if the client already has the current version.
    if (req.headers['if-none-match'] === etag) {
      res.status(304).end();
      return;
    }

    res
      .setHeader('ETag', etag)
      .setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300')
      .json(docs);
  },
};
