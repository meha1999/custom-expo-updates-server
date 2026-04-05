import { NextApiRequest, NextApiResponse } from 'next';
import { readApiKeyFromRequest } from '../../../common/auth';
import { insertRequestLog, insertUpdateAck, validateApiKey } from '../../../common/controlPlaneDb';
import { getRequestContext } from '../../../common/requestContext';
import { SINGLE_APP_SLUG } from '../../../common/singleApp';

export default function telemetryAckEndpoint(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Expected POST.' });
    return;
  }

  const apiKey = readApiKeyFromRequest(req);
  const keyRecord = validateApiKey(apiKey, 'telemetry:write');
  if (!keyRecord) {
    res.status(401).json({ error: 'Invalid or missing API key' });
    return;
  }

  const context = getRequestContext(req);
  const status = req.body?.status;
  const crashSignal = `${req.body?.crashSignal ?? ''}`.trim() || undefined;
  if (!status || (status !== 'downloaded' && status !== 'applied' && status !== 'failed' && status !== 'rolled_back')) {
    res.status(400).json({ error: 'status must be downloaded, applied, failed, or rolled_back' });
    return;
  }

  try {
    insertUpdateAck({
      appSlug: SINGLE_APP_SLUG,
      deviceId: `${req.body?.deviceId ?? context.deviceId}`.trim(),
      runtimeVersion: `${req.body?.runtimeVersion ?? context.runtimeVersion ?? ''}`.trim() || undefined,
      updateId: `${req.body?.updateId ?? ''}`.trim() || undefined,
      status,
      reason: `${req.body?.reason ?? ''}`.trim() || undefined,
      detailsJson: JSON.stringify({
        ...(req.body?.details && typeof req.body.details === 'object' ? req.body.details : {}),
        ...(crashSignal ? { crashSignal } : {}),
      }),
    });

    insertRequestLog({
      timestamp: new Date().toISOString(),
      eventType: 'ack_success',
      requestPath: '/api/telemetry/ack',
      method: 'POST',
      status: 200,
      appSlug: SINGLE_APP_SLUG,
      channelName: `${req.body?.channelName ?? context.channelName}`.trim() || undefined,
      platform: context.platform,
      runtimeVersion: `${req.body?.runtimeVersion ?? context.runtimeVersion ?? ''}`.trim() || undefined,
      updateId: `${req.body?.updateId ?? ''}`.trim() || undefined,
      message: [req.body?.reason, crashSignal ? `crash=${crashSignal}` : null].filter(Boolean).join(' | ') || undefined,
      ip: context.ip,
      userAgent: context.userAgent,
      deviceId: `${req.body?.deviceId ?? context.deviceId}`.trim(),
      appVersion: context.appVersion,
    });

    res.status(200).json({ ok: true });
  } catch (error) {
    insertRequestLog({
      timestamp: new Date().toISOString(),
      eventType: 'ack_error',
      requestPath: '/api/telemetry/ack',
      method: 'POST',
      status: 500,
      appSlug: SINGLE_APP_SLUG,
      channelName: `${req.body?.channelName ?? context.channelName}`.trim() || undefined,
      platform: context.platform,
      runtimeVersion: `${req.body?.runtimeVersion ?? context.runtimeVersion ?? ''}`.trim() || undefined,
      message: error instanceof Error ? error.message : 'Failed to insert ack',
      ip: context.ip,
      userAgent: context.userAgent,
      deviceId: `${req.body?.deviceId ?? context.deviceId}`.trim(),
      appVersion: context.appVersion,
    });
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to insert ack' });
  }
}
