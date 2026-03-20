import { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '../../../common/auth';
import { createUser, insertAdminAuditLog, listUsers } from '../../../common/controlPlaneDb';

export default function usersEndpoint(req: NextApiRequest, res: NextApiResponse) {
  const admin = requireAuth(req, res, { role: 'admin' });
  if (!admin) {
    return;
  }

  if (req.method === 'GET') {
    res.status(200).json({ items: listUsers() });
    return;
  }

  if (req.method === 'POST') {
    const username = `${req.body?.username ?? ''}`.trim();
    const password = `${req.body?.password ?? ''}`;
    const role = req.body?.role === 'viewer' ? 'viewer' : 'admin';

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
        actorUsername: admin.username,
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

  res.status(405).json({ error: 'Expected GET or POST.' });
}
