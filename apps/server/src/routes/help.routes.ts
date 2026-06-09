// /api/help-data — exports the searchable help corpus the client indexes locally. Auth required.
import { Router } from 'express';
import { helpController } from '../controllers/help.controller.js';
import { requireAuth } from '../middlewares/auth.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();

// Any authenticated role can fetch the search corpus.
router.get('/export', requireAuth, asyncHandler(helpController.exportSearchData));

export const helpRouter = router;
