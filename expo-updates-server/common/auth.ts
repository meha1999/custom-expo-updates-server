import { NextApiRequest, NextApiResponse } from 'next';
import { AuthUser, getUserBySessionToken } from './controlPlaneDb';

export type AuthRole = 'admin' | 'viewer';

const SESSION_COOKIE_NAME = 'dashboard_session';

export function parseCookieHeader(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) {
    return {};
  }
  const out: Record<string, string> = {};
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const [rawKey, ...rawValue] = part.trim().split('=');
    if (!rawKey) {
      continue;
    }
    out[decodeURIComponent(rawKey)] = decodeURIComponent(rawValue.join('='));
  }
  return out;
}

export function getSessionTokenFromRequest(req: NextApiRequest): string | null {
  const cookies = parseCookieHeader(req.headers.cookie);
  return cookies[SESSION_COOKIE_NAME] ?? null;
}

export function setSessionCookie(res: NextApiResponse, token: string, maxAgeSeconds: number): void {
  const secureFlag = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  const cookie = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
  ].join('; ') + secureFlag;
  res.setHeader('Set-Cookie', cookie);
}

export function clearSessionCookie(res: NextApiResponse): void {
  const secureFlag = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  const cookie = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
  ].join('; ') + secureFlag;
  res.setHeader('Set-Cookie', cookie);
}

export function getAuthenticatedUser(req: NextApiRequest): AuthUser | null {
  const token = getSessionTokenFromRequest(req);
  if (!token) {
    return null;
  }
  return getUserBySessionToken(token);
}

export function requireAuth(
  req: NextApiRequest,
  res: NextApiResponse,
  options?: {
    role?: AuthRole;
  },
): AuthUser | null {
  const user = getAuthenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  if (options?.role === 'admin' && user.role !== 'admin') {
    res.status(403).json({ error: 'Forbidden' });
    return null;
  }
  if (isMutationMethod(req.method) && !isTrustedOrigin(req)) {
    res.status(403).json({ error: 'Invalid origin' });
    return null;
  }
  return user;
}

function isMutationMethod(method: string | undefined): boolean {
  return method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE';
}

function isTrustedOrigin(req: NextApiRequest): boolean {
  const origin = getHeader(req.headers.origin);
  const referer = getHeader(req.headers.referer);
  if (!origin && !referer) {
    // Non-browser clients (CLI, server-to-server) usually do not send origin/referer.
    return true;
  }

  const requestHost = getHeader(req.headers['x-forwarded-host']) ?? getHeader(req.headers.host);
  if (!requestHost) {
    return false;
  }
  const forwardedProto = getHeader(req.headers['x-forwarded-proto']);
  const protocol = forwardedProto || (process.env.NODE_ENV === 'production' ? 'https' : 'http');
  const expectedOrigin = `${protocol}://${requestHost}`.toLowerCase();
  const configuredOrigin = process.env.HOSTNAME?.trim().replace(/\/+$/, '').toLowerCase();

  const allowedOrigins = new Set([expectedOrigin, ...(configuredOrigin ? [configuredOrigin] : [])]);
  const candidate = (origin || extractOriginFromReferer(referer) || '').toLowerCase();
  return candidate !== '' && allowedOrigins.has(candidate);
}

function extractOriginFromReferer(referer: string | undefined): string | undefined {
  if (!referer) {
    return undefined;
  }
  try {
    return new URL(referer).origin;
  } catch {
    return undefined;
  }
}

function getHeader(value: string | string[] | undefined): string | undefined {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (Array.isArray(value) && value.length > 0) {
    return value[0]?.trim();
  }
  return undefined;
}

export function readBearerToken(req: NextApiRequest): string | undefined {
  const header = req.headers.authorization;
  if (!header || Array.isArray(header)) {
    return undefined;
  }
  const [kind, token] = header.split(' ');
  if (kind?.toLowerCase() !== 'bearer' || !token) {
    return undefined;
  }
  return token.trim();
}

export function readApiKeyFromRequest(req: NextApiRequest): string | undefined {
  const explicit = req.headers['x-api-key'];
  if (typeof explicit === 'string' && explicit.trim()) {
    return explicit.trim();
  }
  if (Array.isArray(explicit) && explicit[0]) {
    return explicit[0].trim();
  }
  return readBearerToken(req);
}
