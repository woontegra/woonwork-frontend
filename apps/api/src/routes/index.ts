import { Router } from 'express';
import authRoutes from './auth.routes';
import tenantRoutes from './tenant.routes';
import projectRoutes from './project.routes';
import taskRoutes from './task.routes';
import pageRoutes from './page.routes';
import dashboardRoutes from './dashboard.routes';
import mediaRoutes from './media.routes';
import databaseRoutes from './database.routes';
import libraryRoutes from './library.routes';
import workspaceAreaRoutes from './workspaceArea.routes';
import shareRoutes from './share.routes';
import favoriteRoutes from './favorite.routes';
import recentRoutes from './recent.routes';
import socialRoutes from './social.routes';
import workspaceTreeRoutes from './workspaceTree.routes';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok' } });
});

router.use('/auth', authRoutes);
router.use('/tenants', tenantRoutes);
router.use('/projects', projectRoutes);
router.use('/tasks', taskRoutes);
router.use('/pages', pageRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/media', mediaRoutes);
router.use('/databases', databaseRoutes);
router.use('/library', libraryRoutes);
router.use('/workspace-areas', workspaceAreaRoutes);
router.use('/shares', shareRoutes);
router.use('/favorites', favoriteRoutes);
router.use('/recents', recentRoutes);
router.use('/social', socialRoutes);
router.use('/workspace-tree', workspaceTreeRoutes);

export default router;
