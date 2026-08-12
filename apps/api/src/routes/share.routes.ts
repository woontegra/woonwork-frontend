import { Router } from 'express';
import * as libraryController from '../controllers/library.controller';
import { requireAuth } from '../middleware/requireAuth';
import { requireTenant } from '../middleware/requireTenant';
import { requireRole } from '../middleware/requireRole';

const router = Router();

router.use(requireAuth, requireTenant);

router.get('/', libraryController.listShares);
router.post('/', requireRole('MEMBER'), libraryController.createShare);
router.patch('/:id', requireRole('MEMBER'), libraryController.updateShare);
router.delete('/:id', requireRole('MEMBER'), libraryController.removeShare);

export default router;
