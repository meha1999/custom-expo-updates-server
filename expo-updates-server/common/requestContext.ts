import crypto from 'crypto';
import { NextApiRequest } from 'next';
import { SINGLE_APP_SLUG } from './singleApp';

export interface RequestContextInfo {
  appSlug: string;
  channelName: string;
  runtimeVersion?: string;
  platform?: string;
  deviceId: string;
  ip?: string;
  userAgent?: string;
  appVersion?: string;
}

export function getSingleValue(value: string | string[] | undefined): string | undefined {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value) && value.length > 0) {
    return value[0];
  }
  return undefined;
}

export function getRequestContext(req: NextApiRequest): RequestContextInfo {
  const appSlug = SINGLE_APP_SLUG;
  const channelName =
    getSingleValue(req.headers['expo-channel-name']) ??
    getSingleValue(req.headers['x-channel-name']) ??
    getQueryValue(req.query.channel) ??
    'production';
  const runtimeVersion =
    getSingleValue(req.headers['expo-runtime-version']) ?? getQueryValue(req.query['runtime-version']);
  const platform = getSingleValue(req.headers['expo-platform']) ?? getQueryValue(req.query.platform);
  const appVersion = getSingleValue(req.headers['x-app-version']) ?? getQueryValue(req.query.appVersion);
  const userAgent = getSingleValue(req.headers['user-agent']);
  const ip = getRequestIp(req);

  const explicitDeviceId =
    getSingleValue(req.headers['x-device-id']) ??
    getSingleValue(req.headers['expo-device-id']) ??
    getSingleValue(req.headers['expo-client-id']) ??
    getQueryValue(req.query.deviceId);
  const fingerprint = `${ip ?? 'unknown'}|${userAgent ?? 'unknown'}|${appSlug}`;
  const fallback = crypto.createHash('sha1').update(fingerprint).digest('hex').slice(0, 16);

  return {
    appSlug,
    channelName,
    runtimeVersion,
    platform,
    deviceId: explicitDeviceId ?? fallback,
    ip,
    userAgent,
    appVersion,
  };
}

function getRequestIp(req: NextApiRequest): string | undefined {
  const forwarded = getSingleValue(req.headers['x-forwarded-for']);
  if (forwarded) {
    const [first] = forwarded.split(',');
    return first?.trim();
  }
  return req.socket.remoteAddress;
}

function getQueryValue(value: string | string[] | undefined): string | undefined {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value) && value.length > 0) {
    return value[0];
  }
  return undefined;
}
