import { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '../../../common/auth';
import {
  createApp,
  insertAdminAuditLog,
  listApps,
  updateAppCodeSigning,
} from '../../../common/controlPlaneDb';

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

  if (req.method === 'PATCH') {
    if (user.role !== 'admin') {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const appSlug = `${req.body?.appSlug ?? ''}`.trim();
    if (!appSlug) {
      res.status(400).json({ error: 'appSlug is required' });
      return;
    }

    const keyIdValue = req.body?.codeSigningKeyId;
    const privateKeyValue = req.body?.codeSigningPrivateKeyPem;
    const clearPrivateKey = Boolean(req.body?.clearCodeSigningPrivateKey);

    try {
      const updated = updateAppCodeSigning({
        appSlug,
        keyId: typeof keyIdValue === 'string' ? keyIdValue : undefined,
        privateKeyPem: typeof privateKeyValue === 'string' ? privateKeyValue : undefined,
        clearPrivateKey,
      });

      insertAdminAuditLog({
        actorUsername: user.username,
        action: 'app.update_signing',
        appSlug: updated.slug,
        details: {
          keyId: updated.codeSigningKeyId,
          hasCodeSigningPrivateKey: updated.hasCodeSigningPrivateKey,
          clearPrivateKey,
        },
      });

      res.status(200).json(updated);
    } catch (error) {
      res.status(400).json({
        error:
          error instanceof Error
            ? error.message
            : 'Failed to update app code signing settings',
      });
    }
    return;
  }

  res.status(405).json({ error: 'Expected GET, POST, or PATCH.' });
}
