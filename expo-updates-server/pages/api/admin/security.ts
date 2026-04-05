import { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '../../../common/auth';
import { getUserRoleCounts } from '../../../common/controlPlaneDb';

const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_LOCK_MS = 15 * 60 * 1000;

export default function securityStatusEndpoint(req: NextApiRequest, res: NextApiResponse) {
  const admin = requireAuth(req, res, { role: 'admin' });
  if (!admin) {
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Expected GET.' });
    return;
  }

  const roleCounts = getUserRoleCounts();
  const configuredAdminPassword = process.env.DASHBOARD_ADMIN_PASSWORD?.trim();
  const hostname = process.env.HOSTNAME?.trim() || '';
  const secureHostname = hostname.toLowerCase().startsWith('https://');
  const production = process.env.NODE_ENV === 'production';

  res.status(200).json({
    auth: {
      passwordHashing: 'scrypt+salt',
      sessionTtlDays: SESSION_MAX_AGE_SECONDS / (24 * 60 * 60),
      cookieHttpOnly: true,
      cookieSameSite: 'Lax',
      cookieSecureInProduction: true,
      csrfOriginProtection: true,
      bruteForceProtection: {
        maxAttempts: LOGIN_MAX_ATTEMPTS,
        windowMinutes: LOGIN_WINDOW_MS / 60000,
        lockMinutes: LOGIN_LOCK_MS / 60000,
      },
      productionAdminOnlyLogin: true,
      productionViewerCreationDisabled: true,
    },
    deployment: {
      nodeEnv: process.env.NODE_ENV || 'development',
      hostname: hostname || null,
      httpsConfigured: secureHostname,
      bootAdminPasswordConfigured: Boolean(configuredAdminPassword),
      bootAdminPasswordIsDefault: configuredAdminPassword === 'change-me-now',
    },
    users: roleCounts,
    storage: {
      engine: 'sqlite',
      path: 'data/control-plane.sqlite',
    },
    generatedAt: new Date().toISOString(),
    production,
  });
}
