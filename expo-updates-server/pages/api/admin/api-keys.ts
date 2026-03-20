import { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '../../../common/auth';
import { createApiKey, insertAdminAuditLog, listApiKeys, revokeApiKey } from '../../../common/controlPlaneDb';

function parseScopes(value: unknown): Array<'telemetry:write' | 'logs:write' | 'admin'> {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(
    (scope): scope is 'telemetry:write' | 'logs:write' | 'admin' =>
      scope === 'telemetry:write' || scope === 'logs:write' || scope === 'admin',
  );
}

export default function apiKeysEndpoint(req: NextApiRequest, res: NextApiResponse) {
  const admin = requireAuth(req, res, { role: 'admin' });
  if (!admin) {
    return;
  }

  if (req.method === 'GET') {
    res.status(200).json({ items: listApiKeys() });
    return;
  }

  if (req.method === 'POST') {
    const name = `${req.body?.name ?? ''}`.trim();
    const scopes = parseScopes(req.body?.scopes);
    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }
    if (scopes.length === 0) {
      res.status(400).json({ error: 'at least one scope is required' });
      return;
    }
    try {
      const created = createApiKey(name, scopes);
      insertAdminAuditLog({
        actorUsername: admin.username,
        action: 'api_key.create',
        appSlug: 'default',
        details: {
          keyId: created.id,
          name: created.name,
          scopes: created.scopes,
        },
      });
      res.status(201).json(created);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to create API key' });
    }
    return;
  }

  if (req.method === 'DELETE') {
    const id = Number(req.body?.id);
    if (!id) {
      res.status(400).json({ error: 'id is required' });
      return;
    }
    revokeApiKey(id);
    insertAdminAuditLog({
      actorUsername: admin.username,
      action: 'api_key.revoke',
      appSlug: 'default',
      details: {
        keyId: id,
      },
    });
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ error: 'Expected GET, POST, or DELETE.' });
}
