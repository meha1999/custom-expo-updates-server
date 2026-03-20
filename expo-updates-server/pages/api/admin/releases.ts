import { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '../../../common/auth';
import {
  assignReleaseToChannel,
  insertAdminAuditLog,
  listReleases,
  registerRelease,
  syncFilesystemReleases,
} from '../../../common/controlPlaneDb';

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

export default function releasesEndpoint(req: NextApiRequest, res: NextApiResponse) {
  const user = requireAuth(req, res);
  if (!user) {
    return;
  }

  if (req.method === 'GET') {
    const appSlug = getQueryValue(req.query.app) ?? 'default';
    const runtimeVersion = getQueryValue(req.query.runtimeVersion);
    syncFilesystemReleases({ appSlug, runtimeVersion });
    res.status(200).json({
      items: listReleases({
        appSlug,
        runtimeVersion,
      }),
    });
    return;
  }

  if (req.method === 'POST') {
    if (user.role !== 'admin') {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const appSlug = `${req.body?.appSlug ?? 'default'}`.trim();
    const runtimeVersion = `${req.body?.runtimeVersion ?? ''}`.trim();
    const bundleId = `${req.body?.bundleId ?? ''}`.trim();
    const channelName = `${req.body?.channelName ?? ''}`.trim();

    if (!runtimeVersion || !bundleId) {
      res.status(400).json({ error: 'runtimeVersion and bundleId are required' });
      return;
    }

    try {
      const release = registerRelease({
        appSlug,
        runtimeVersion,
        bundleId,
      });

      let policy: unknown = null;
      if (channelName) {
        policy = assignReleaseToChannel({
          appSlug,
          channelName,
          runtimeVersion,
          releaseId: release.id,
          rolloutPercentage:
            req.body?.rolloutPercentage === undefined ? undefined : Number(req.body.rolloutPercentage),
          allowlist: parseDeviceList(req.body?.allowlist),
          blocklist: parseDeviceList(req.body?.blocklist),
        });
      }

      insertAdminAuditLog({
        actorUsername: user.username,
        action: 'release.register',
        appSlug,
        details: {
          runtimeVersion,
          bundleId,
          channelName: channelName || null,
          releaseId: release.id,
        },
      });

      res.status(201).json({
        release,
        policy,
      });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to register release' });
    }
    return;
  }

  res.status(405).json({ error: 'Expected GET or POST.' });
}
