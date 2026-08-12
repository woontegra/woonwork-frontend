import { Router } from 'express';
import * as mediaController from '../controllers/media.controller';
import { requireAuth } from '../middleware/requireAuth';
import { requireTenant } from '../middleware/requireTenant';
import { requireRole } from '../middleware/requireRole';

const router = Router();

router.use(requireAuth, requireTenant);

router.get('/', mediaController.list);
router.get('/usage', mediaController.usage);
router.get('/:id', mediaController.getById);
router.post('/prepare', requireRole('MEMBER'), mediaController.preparePath);
router.post('/upload', requireRole('MEMBER'), mediaController.upload);
router.post('/finalize', requireRole('MEMBER'), mediaController.finalize);
router.delete('/:id', requireRole('EDITOR'), mediaController.remove);

export default router;
