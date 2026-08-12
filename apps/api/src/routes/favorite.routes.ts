import { Router } from 'express';
import * as libraryController from '../controllers/library.controller';
import { requireAuth } from '../middleware/requireAuth';
import { requireTenant } from '../middleware/requireTenant';
import { requireRole } from '../middleware/requireRole';

const router = Router();

router.use(requireAuth, requireTenant);

router.get('/', libraryController.listFavorites);
router.post('/', requireRole('MEMBER'), libraryController.addFavorite);
router.delete(
  '/:resourceType/:resourceId',
  requireRole('MEMBER'),
  libraryController.removeFavorite,
);

export default router;
