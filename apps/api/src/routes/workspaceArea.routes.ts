import { Router } from 'express';
import * as libraryController from '../controllers/library.controller';
import { requireAuth } from '../middleware/requireAuth';
import { requireTenant } from '../middleware/requireTenant';
import { requireRole } from '../middleware/requireRole';

const router = Router();

router.use(requireAuth, requireTenant);

router.get('/', libraryController.listAreas);
router.post('/', requireRole('MEMBER'), libraryController.createArea);
router.get('/:id', libraryController.getArea);
router.patch('/:id', requireRole('MEMBER'), libraryController.updateArea);
router.delete('/:id', requireRole('EDITOR'), libraryController.removeArea);
router.get('/:id/contents', libraryController.areaContents);
router.get('/:id/members', libraryController.listAreaMembers);
router.post('/:id/members', requireRole('MEMBER'), libraryController.upsertAreaMember);
router.delete('/:id/members/:userId', requireRole('MEMBER'), libraryController.removeAreaMember);

export default router;
