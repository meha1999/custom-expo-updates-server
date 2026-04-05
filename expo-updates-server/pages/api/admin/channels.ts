import { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '../../../common/auth';
import {
  createChannel,
  insertAdminAuditLog,
  listChannels,
  listRuntimePolicies,
  setRuntimePolicy,
} from '../../../common/controlPlaneDb';
import { SINGLE_APP_SLUG } from '../../../common/singleApp';

function getQueryValue(value: string | string[] | undefined): string | undefined {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value) && value.length > 0) {
    return value[0];
  }
  return undefined;
}

function parseDeviceList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

export default function channelsEndpoint(req: NextApiRequest, res: NextApiResponse) {
  const user = requireAuth(req, res);
  if (!user) {
    return;
  }

  if (req.method === 'GET') {
    res.status(200).json({
      channels: listChannels(SINGLE_APP_SLUG),
      policies: listRuntimePolicies({
        appSlug: SINGLE_APP_SLUG,
        channelName: getQueryValue(req.query.channel),
      }),
    });
    return;
  }

  if (req.method === 'POST') {
    if (user.role !== 'admin') {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const channelName = `${req.body?.channelName ?? ''}`.trim();
    if (!channelName) {
      res.status(400).json({ error: 'channelName is required' });
      return;
    }
    try {
      const created = createChannel(SINGLE_APP_SLUG, channelName);
      insertAdminAuditLog({
        actorUsername: user.username,
        action: 'channel.create',
        appSlug: SINGLE_APP_SLUG,
        details: {
          channelName,
        },
      });
      res.status(201).json(created);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to create channel' });
    }
    return;
  }

  if (req.method === 'PUT') {
    if (user.role !== 'admin') {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const channelName = `${req.body?.channelName ?? ''}`.trim();
    const runtimeVersion = `${req.body?.runtimeVersion ?? ''}`.trim();
    if (!channelName || !runtimeVersion) {
      res.status(400).json({ error: 'channelName and runtimeVersion are required' });
      return;
    }
    try {
      const rawActiveReleaseId = req.body?.activeReleaseId;
      const parsedActiveReleaseId =
        rawActiveReleaseId === undefined
          ? undefined
          : rawActiveReleaseId === null
          ? null
          : Number(rawActiveReleaseId);

      const policy = setRuntimePolicy({
        appSlug: SINGLE_APP_SLUG,
        channelName,
        runtimeVersion,
        activeReleaseId: parsedActiveReleaseId,
        rolloutPercentage:
          req.body?.rolloutPercentage === undefined ? undefined : Number(req.body.rolloutPercentage),
        allowlist: parseDeviceList(req.body?.allowlist),
        blocklist: parseDeviceList(req.body?.blocklist),
        rollbackToEmbedded:
          req.body?.rollbackToEmbedded === undefined ? undefined : Boolean(req.body.rollbackToEmbedded),
      });
      insertAdminAuditLog({
        actorUsername: user.username,
        action: 'channel.policy.update',
        appSlug: SINGLE_APP_SLUG,
        details: {
          channelName,
          runtimeVersion,
          policyId: policy.id,
        },
      });
      res.status(200).json(policy);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to update policy' });
    }
    return;
  }

  res.status(405).json({ error: 'Expected GET, POST, or PUT.' });
}
