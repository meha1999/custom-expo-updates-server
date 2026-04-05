import { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '../../../common/auth';
import {
  changeUserPassword,
  createUser,
  insertAdminAuditLog,
  listUsers,
} from '../../../common/controlPlaneDb';

export default function usersEndpoint(req: NextApiRequest, res: NextApiResponse) {
  const user = requireAuth(req, res);
  if (!user) {
    return;
  }

  if (req.method === 'GET') {
    if (user.role !== 'admin') {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    res.status(200).json({ items: listUsers() });
    return;
  }

  if (req.method === 'POST') {
    if (user.role !== 'admin') {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const username = `${req.body?.username ?? ''}`.trim();
    const password = `${req.body?.password ?? ''}`;
    const requestedRole = req.body?.role === 'viewer' ? 'viewer' : 'admin';
    if (process.env.NODE_ENV === 'production' && requestedRole !== 'admin') {
      res.status(403).json({ error: 'Viewer accounts are disabled in production.' });
      return;
    }
    const role = requestedRole;

    if (!username || !password) {
      res.status(400).json({ error: 'username and password are required' });
      return;
    }

    try {
      const created = createUser({
        username,
        password,
        role,
      });
      insertAdminAuditLog({
        actorUsername: user.username,
        action: 'user.create',
        appSlug: 'default',
        details: {
          username: created.username,
          role: created.role,
        },
      });
      res.status(201).json(created);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to create user' });
    }
    return;
  }

  if (req.method === 'PATCH') {
    const currentPassword = `${req.body?.currentPassword ?? ''}`;
    const newPassword = `${req.body?.newPassword ?? ''}`;
    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: 'currentPassword and newPassword are required' });
      return;
    }
    try {
      changeUserPassword({
        userId: user.id,
        currentPassword,
        newPassword,
      });
      insertAdminAuditLog({
        actorUsername: user.username,
        action: 'user.password.change',
        appSlug: 'default',
        details: {
          userId: user.id,
          username: user.username,
        },
      });
      res.status(200).json({ ok: true });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to change password',
      });
    }
    return;
  }

  res.status(405).json({ error: 'Expected GET, POST, or PATCH.' });
}
