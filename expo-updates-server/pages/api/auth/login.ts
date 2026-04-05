import { NextApiRequest, NextApiResponse } from 'next';
import { authenticateUser, invalidateSession } from '../../../common/controlPlaneDb';
import { setSessionCookie } from '../../../common/auth';
import { getRequestContext } from '../../../common/requestContext';

const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_LOCK_MS = 15 * 60 * 1000;

interface LoginAttemptState {
  failures: number[];
  lockedUntil?: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __loginAttemptMap: Map<string, LoginAttemptState> | undefined;
}

function getAttemptMap(): Map<string, LoginAttemptState> {
  if (!global.__loginAttemptMap) {
    global.__loginAttemptMap = new Map<string, LoginAttemptState>();
  }
  return global.__loginAttemptMap;
}

function getThrottleKey(req: NextApiRequest, username: string): string {
  const ip = getRequestContext(req).ip ?? 'unknown';
  return `${ip}|${username.toLowerCase()}`;
}

function getRemainingLockMs(req: NextApiRequest, username: string): number {
  const state = getAttemptMap().get(getThrottleKey(req, username));
  if (!state?.lockedUntil) {
    return 0;
  }
  const remaining = state.lockedUntil - Date.now();
  return remaining > 0 ? remaining : 0;
}

function recordLoginFailure(req: NextApiRequest, username: string): void {
  const key = getThrottleKey(req, username);
  const map = getAttemptMap();
  const now = Date.now();
  const state = map.get(key) ?? { failures: [] };
  state.failures = state.failures.filter((timestamp) => now - timestamp <= LOGIN_WINDOW_MS);
  state.failures.push(now);
  if (state.failures.length >= LOGIN_MAX_ATTEMPTS) {
    state.lockedUntil = now + LOGIN_LOCK_MS;
    state.failures = [];
  }
  map.set(key, state);
}

function clearLoginFailures(req: NextApiRequest, username: string): void {
  getAttemptMap().delete(getThrottleKey(req, username));
}

export default function loginEndpoint(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Expected POST.' });
    return;
  }

  const username = `${req.body?.username ?? ''}`.trim();
  const password = `${req.body?.password ?? ''}`;
  if (!username || !password) {
    res.status(400).json({ error: 'username and password are required' });
    return;
  }

  const remainingLockMs = getRemainingLockMs(req, username);
  if (remainingLockMs > 0) {
    res.status(429).json({
      error: 'Too many login attempts. Try again later.',
      retryAfterSeconds: Math.ceil(remainingLockMs / 1000),
    });
    return;
  }

  try {
    const session = authenticateUser(username, password);
    if (process.env.NODE_ENV === 'production' && session.user.role !== 'admin') {
      invalidateSession(session.token);
      res.status(403).json({
        error: 'Only admin login is allowed in production.',
      });
      return;
    }
    clearLoginFailures(req, username);
    setSessionCookie(res, session.token, SESSION_MAX_AGE_SECONDS);
    res.status(200).json({
      user: session.user,
      expiresAt: session.expiresAt,
    });
  } catch (error) {
    recordLoginFailure(req, username);
    res.status(401).json({
      error: error instanceof Error ? error.message : 'Login failed',
    });
  }
}
