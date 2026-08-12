import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as socialController from '../controllers/social.controller';
import * as socialMetaController from '../controllers/socialMeta.controller';
import { requireAuth } from '../middleware/requireAuth';
import { requireTenant } from '../middleware/requireTenant';
import { requireRole } from '../middleware/requireRole';

const router = Router();

const oauthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Çok fazla OAuth denemesi. Lütfen sonra tekrar deneyin.' },
  },
});

const publishLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Çok fazla yayın denemesi. Lütfen sonra tekrar deneyin.' },
  },
});

router.get('/meta/oauth/callback', oauthLimiter, socialMetaController.metaOauthCallback);

router.use(requireAuth, requireTenant);

router.get('/brands', socialController.listBrands);
router.get('/brands/:id', socialController.getBrand);
router.post('/brands', requireRole('MEMBER'), socialController.createBrand);
router.patch('/brands/:id', requireRole('MEMBER'), socialController.updateBrand);
router.delete('/brands/:id', requireRole('EDITOR'), socialController.removeBrand);

router.get('/hashtags', socialController.listHashtags);
router.post('/hashtags/bulk', requireRole('MEMBER'), socialController.bulkCreateHashtags);
router.post('/hashtags', requireRole('MEMBER'), socialController.createHashtag);
router.patch('/hashtags/:id', requireRole('MEMBER'), socialController.updateHashtag);
router.delete('/hashtags/:id', requireRole('EDITOR'), socialController.removeHashtag);

router.get('/contents/overview', socialController.overview);
router.get('/contents/calendar', socialController.calendar);
router.get('/contents/unscheduled', socialController.unscheduled);
router.get('/contents', socialController.listContents);
router.get('/contents/:id', socialController.getContent);
router.post('/contents', requireRole('MEMBER'), socialController.createContent);
router.patch('/contents/:id', requireRole('MEMBER'), socialController.updateContent);
router.delete('/contents/:id', requireRole('EDITOR'), socialController.removeContent);
router.post('/contents/:id/duplicate', requireRole('MEMBER'), socialController.duplicateContent);
router.post('/contents/:id/media', requireRole('MEMBER'), socialController.addMedia);
router.delete('/contents/:id/media/:mediaId', requireRole('MEMBER'), socialController.removeMedia);
router.post('/contents/:id/media/reorder', requireRole('MEMBER'), socialController.reorderMedia);
router.post(
  '/contents/:id/publish',
  requireRole('MEMBER'),
  publishLimiter,
  socialMetaController.publishContent,
);

router.get('/meta/oauth/start', requireRole('MEMBER'), oauthLimiter, socialMetaController.startMetaOauth);
router.get(
  '/meta/oauth/status/:sessionId',
  requireRole('MEMBER'),
  socialMetaController.metaOauthStatus,
);
router.get('/meta/discovery', requireRole('MEMBER'), socialMetaController.discoverMeta);
router.post('/meta/accounts/connect', requireRole('MEMBER'), socialMetaController.connectMetaAccounts);

router.get('/accounts', socialMetaController.listAccounts);
router.patch('/accounts/:id', requireRole('MEMBER'), socialMetaController.updateAccount);
router.delete('/accounts/:id', requireRole('MEMBER'), socialMetaController.disconnectAccount);

export default router;
