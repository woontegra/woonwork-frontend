import { Router } from 'express';
import * as workspaceTreeController from '../controllers/workspaceTree.controller';
import { requireAuth } from '../middleware/requireAuth';
import { requireTenant } from '../middleware/requireTenant';

const router = Router();

router.use(requireAuth, requireTenant);
router.get('/', workspaceTreeController.tree);

export default router;
