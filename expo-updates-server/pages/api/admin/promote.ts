import { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '../../../common/auth';
import { insertAdminAuditLog, promoteRelease } from '../../../common/controlPlaneDb';
import { SINGLE_APP_SLUG } from '../../../common/singleApp';

export default function promoteEndpoint(req: NextApiRequest, res: NextApiResponse) {
  const admin = requireAuth(req, res, { role: 'admin' });
  if (!admin) {
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Expected POST.' });
    return;
  }

  const sourceChannelName = `${req.body?.sourceChannelName ?? ''}`.trim();
  const targetChannelName = `${req.body?.targetChannelName ?? ''}`.trim();
  const runtimeVersion = `${req.body?.runtimeVersion ?? ''}`.trim();
  if (!sourceChannelName || !targetChannelName || !runtimeVersion) {
    res.status(400).json({ error: 'sourceChannelName, targetChannelName, and runtimeVersion are required' });
    return;
  }

  try {
    const policy = promoteRelease({
      appSlug: SINGLE_APP_SLUG,
      sourceChannelName,
      targetChannelName,
      runtimeVersion,
    });
    insertAdminAuditLog({
      actorUsername: admin.username,
      action: 'release.promote',
      appSlug: SINGLE_APP_SLUG,
      details: {
        sourceChannelName,
        targetChannelName,
        runtimeVersion,
        policyId: policy.id,
      },
    });
    res.status(200).json(policy);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Promotion failed' });
  }
}
