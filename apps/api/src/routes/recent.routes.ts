import { Router } from 'express';
import * as libraryController from '../controllers/library.controller';
import { requireAuth } from '../middleware/requireAuth';
import { requireTenant } from '../middleware/requireTenant';

const router = Router();

router.use(requireAuth, requireTenant);

router.get('/', libraryController.listRecents);

export default router;
