import { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '../../../common/auth';
import { insertAdminAuditLog, rollbackChannel } from '../../../common/controlPlaneDb';

export default function rollbackEndpoint(req: NextApiRequest, res: NextApiResponse) {
  const admin = requireAuth(req, res, { role: 'admin' });
  if (!admin) {
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Expected POST.' });
    return;
  }

  const appSlug = `${req.body?.appSlug ?? 'default'}`.trim();
  const channelName = `${req.body?.channelName ?? ''}`.trim();
  const runtimeVersion = `${req.body?.runtimeVersion ?? ''}`.trim();
  if (!channelName || !runtimeVersion) {
    res.status(400).json({ error: 'channelName and runtimeVersion are required' });
    return;
  }

  try {
    const policy = rollbackChannel({
      appSlug,
      channelName,
      runtimeVersion,
    });
    insertAdminAuditLog({
      actorUsername: admin.username,
      action: 'release.rollback',
      appSlug,
      details: {
        channelName,
        runtimeVersion,
        policyId: policy.id,
      },
    });
    res.status(200).json(policy);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Rollback failed' });
  }
}
