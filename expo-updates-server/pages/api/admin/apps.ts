import { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '../../../common/auth';
import { createApp, insertAdminAuditLog, listApps } from '../../../common/controlPlaneDb';

export default function appsEndpoint(req: NextApiRequest, res: NextApiResponse) {
  const user = requireAuth(req, res);
  if (!user) {
    return;
  }

  if (req.method === 'GET') {
    res.status(200).json({ items: listApps() });
    return;
  }

  if (req.method === 'POST') {
    if (user.role !== 'admin') {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const name = `${req.body?.name ?? ''}`.trim();
    const slug = `${req.body?.slug ?? ''}`.trim();
    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }
    try {
      const created = createApp(name, slug || undefined);
      insertAdminAuditLog({
        actorUsername: user.username,
        action: 'app.create',
        appSlug: created.slug,
        details: {
          name: created.name,
          slug: created.slug,
        },
      });
      res.status(201).json(created);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to create app' });
    }
    return;
  }

  res.status(405).json({ error: 'Expected GET or POST.' });
}
