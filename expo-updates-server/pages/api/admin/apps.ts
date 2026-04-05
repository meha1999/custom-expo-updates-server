import { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '../../../common/auth';
import {
  getOrCreateAppBySlug,
  insertAdminAuditLog,
  listApps,
  updateAppCodeSigning,
} from '../../../common/controlPlaneDb';
import { SINGLE_APP_SLUG } from '../../../common/singleApp';

export default function appsEndpoint(req: NextApiRequest, res: NextApiResponse) {
  const user = requireAuth(req, res);
  if (!user) {
    return;
  }

  if (req.method === 'GET') {
    const defaultApp = getOrCreateAppBySlug(SINGLE_APP_SLUG);
    const singleAppList = listApps().filter((item) => item.slug === defaultApp.slug);
    res.status(200).json({ items: singleAppList.length > 0 ? singleAppList : [defaultApp] });
    return;
  }

  if (req.method === 'POST') {
    res.status(405).json({ error: 'Single-app mode: creating apps is disabled.' });
    return;
  }

  if (req.method === 'PATCH') {
    if (user.role !== 'admin') {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const keyIdValue = req.body?.codeSigningKeyId;
    const privateKeyValue = req.body?.codeSigningPrivateKeyPem;
    const clearPrivateKey = Boolean(req.body?.clearCodeSigningPrivateKey);

    try {
      const updated = updateAppCodeSigning({
        appSlug: SINGLE_APP_SLUG,
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

  res.status(405).json({ error: 'Expected GET or PATCH.' });
}
