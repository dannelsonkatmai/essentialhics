import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import type { AuthenticatedRequest } from '../../types';
import * as svc from './notification.service';

const router = Router();
router.use(requireAuth);

router.get('/', async (req: AuthenticatedRequest, res) => {
  const page = Number(req.query.page) || 1;
  const limit = Math.min(Number(req.query.limit) || 25, 100);
  const unreadOnly = req.query.unread === 'true';
  const result = await svc.listNotifications(req.user.id, { unreadOnly, page, limit });
  res.json(result);
});

router.get('/unread-count', async (req: AuthenticatedRequest, res) => {
  const count = await svc.getUnreadCount(req.user.id);
  res.json({ count });
});

router.post('/:id/read', async (req: AuthenticatedRequest, res) => {
  await svc.markRead(req.params.id!, req.user.id);
  res.json({ ok: true });
});

router.post('/read-all', async (req: AuthenticatedRequest, res) => {
  await svc.markAllRead(req.user.id);
  res.json({ ok: true });
});

export default router;
