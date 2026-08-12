import { Router } from 'express';
import * as pageController from '../controllers/page.controller';
import * as blockController from '../controllers/block.controller';
import { requireAuth } from '../middleware/requireAuth';
import { requireTenant } from '../middleware/requireTenant';
import { requireRole } from '../middleware/requireRole';

const router = Router();

router.use(requireAuth, requireTenant);

router.get('/', pageController.list);
router.post('/', requireRole('MEMBER'), pageController.create);

router.get('/:pageId/blocks', blockController.list);
router.post('/:pageId/blocks', requireRole('MEMBER'), blockController.create);
router.post('/:pageId/blocks/reorder', requireRole('MEMBER'), blockController.reorder);
router.post(
  '/:pageId/blocks/:blockId/duplicate',
  requireRole('MEMBER'),
  blockController.duplicate,
);
router.patch('/:pageId/blocks/:blockId', requireRole('MEMBER'), blockController.update);
router.delete('/:pageId/blocks/:blockId', requireRole('EDITOR'), blockController.remove);

router.get('/:id', pageController.getById);
router.patch('/:id', requireRole('EDITOR'), pageController.update);
router.post('/:id/move', requireRole('MEMBER'), pageController.move);
router.post('/:id/duplicate', requireRole('MEMBER'), pageController.duplicate);
router.post('/:id/subpages', requireRole('MEMBER'), pageController.createSubpage);
router.delete('/:id', requireRole('EDITOR'), pageController.remove);

export default router;
