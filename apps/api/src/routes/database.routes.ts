import { Router } from 'express';
import * as databaseController from '../controllers/database.controller';
import { requireAuth } from '../middleware/requireAuth';
import { requireTenant } from '../middleware/requireTenant';
import { requireRole } from '../middleware/requireRole';

const router = Router();

router.use(requireAuth, requireTenant);

router.get('/', databaseController.list);
router.post('/', requireRole('MEMBER'), databaseController.create);
router.get('/:id', databaseController.getById);
router.patch('/:id', requireRole('MEMBER'), databaseController.update);
router.post('/:id/move', requireRole('MEMBER'), databaseController.move);
router.delete('/:id', requireRole('EDITOR'), databaseController.remove);

router.post('/:id/properties', requireRole('MEMBER'), databaseController.createProperty);
router.patch(
  '/:id/properties/:propertyId',
  requireRole('MEMBER'),
  databaseController.updateProperty,
);
router.delete(
  '/:id/properties/:propertyId',
  requireRole('EDITOR'),
  databaseController.removeProperty,
);
router.post(
  '/:id/properties/reorder',
  requireRole('MEMBER'),
  databaseController.reorderProperties,
);

router.get('/:id/rows', databaseController.listRows);
router.post('/:id/rows', requireRole('MEMBER'), databaseController.createRow);
router.post('/:id/rows/reorder', requireRole('MEMBER'), databaseController.reorderRows);
router.post('/:id/rows/move', requireRole('MEMBER'), databaseController.moveRow);
router.post(
  '/:id/rows/:rowId/duplicate',
  requireRole('MEMBER'),
  databaseController.duplicateRow,
);
router.delete('/:id/rows/:rowId', requireRole('EDITOR'), databaseController.removeRow);
router.patch(
  '/:id/rows/:rowId/cells/:propertyId',
  requireRole('MEMBER'),
  databaseController.updateCell,
);

router.get('/:id/views', databaseController.listViews);
router.post('/:id/views', requireRole('MEMBER'), databaseController.createView);
router.patch('/:id/views/:viewId', requireRole('MEMBER'), databaseController.updateView);
router.post(
  '/:id/views/:viewId/duplicate',
  requireRole('MEMBER'),
  databaseController.duplicateView,
);
router.delete('/:id/views/:viewId', requireRole('EDITOR'), databaseController.removeView);

export default router;
