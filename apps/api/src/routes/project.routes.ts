import { Router } from 'express';
import * as projectController from '../controllers/project.controller';
import { requireAuth } from '../middleware/requireAuth';
import { requireTenant } from '../middleware/requireTenant';
import { requireRole } from '../middleware/requireRole';

const router = Router();

router.use(requireAuth, requireTenant);

router.get('/', projectController.list);
router.post('/', requireRole('MEMBER'), projectController.create);
router.get('/:id', projectController.getById);
router.patch('/:id', requireRole('EDITOR'), projectController.update);
router.post('/:id/move', requireRole('MEMBER'), projectController.move);
router.delete('/:id', requireRole('ADMIN'), projectController.remove);

export default router;
