import { NextApiRequest, NextApiResponse } from 'next';
import { readApiKeyFromRequest } from '../../../common/auth';
import { DashboardLogEvent, insertRequestLog, validateApiKey } from '../../../common/controlPlaneDb';
import { getRequestContext } from '../../../common/requestContext';

export default function telemetryLogEndpoint(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Expected POST.' });
    return;
  }

  const apiKey = readApiKeyFromRequest(req);
  const keyRecord = validateApiKey(apiKey, 'logs:write');
  if (!keyRecord) {
    res.status(401).json({ error: 'Invalid or missing API key' });
    return;
  }

  const context = getRequestContext(req);
  const eventType = `${req.body?.eventType ?? 'asset_success'}`.trim();
  const allowedEventTypes = new Set([
    'manifest_update',
    'manifest_rollback',
    'manifest_no_update',
    'manifest_error',
    'asset_success',
    'asset_error',
    'ack_success',
    'ack_error',
  ]);
  if (!allowedEventTypes.has(eventType)) {
    res.status(400).json({ error: 'Unsupported eventType' });
    return;
  }

  const status = Number(req.body?.status ?? 200);
  insertRequestLog({
    timestamp: new Date().toISOString(),
    eventType: eventType as DashboardLogEvent['eventType'],
    requestPath: `${req.body?.requestPath ?? '/external'}`,
    method: `${req.body?.method ?? 'POST'}`,
    status,
    appSlug: `${req.body?.appSlug ?? context.appSlug}`.trim() || 'default',
    channelName: `${req.body?.channelName ?? context.channelName}`.trim() || undefined,
    platform: `${req.body?.platform ?? context.platform ?? ''}`.trim() || undefined,
    runtimeVersion: `${req.body?.runtimeVersion ?? context.runtimeVersion ?? ''}`.trim() || undefined,
    updateId: `${req.body?.updateId ?? ''}`.trim() || undefined,
    bundlePath: `${req.body?.bundlePath ?? ''}`.trim() || undefined,
    assetName: `${req.body?.assetName ?? ''}`.trim() || undefined,
    message: `${req.body?.message ?? ''}`.trim() || undefined,
    ip: context.ip,
    userAgent: context.userAgent,
    deviceId: `${req.body?.deviceId ?? context.deviceId}`.trim(),
    appVersion: context.appVersion,
  });

  res.status(200).json({ ok: true });
}
