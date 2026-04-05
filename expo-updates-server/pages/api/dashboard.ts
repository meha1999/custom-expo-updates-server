import { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '../../common/auth';
import { getDashboardSnapshot } from '../../common/controlPlaneDb';
import { getSingleValue } from '../../common/requestContext';
import { SINGLE_APP_SLUG } from '../../common/singleApp';

export default async function dashboardEndpoint(req: NextApiRequest, res: NextApiResponse) {
  const user = requireAuth(req, res);
  if (!user) {
    return;
  }

  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.json({ error: 'Expected GET.' });
    return;
  }

  const queryLimit = getSingleValue(req.query.limit);
  const limit = Number.parseInt(queryLimit ?? '100', 10);
  const safeLimit = Number.isFinite(limit) ? limit : 100;

  try {
    const snapshot = getDashboardSnapshot({
      appSlug: SINGLE_APP_SLUG,
      limit: safeLimit,
    });
    res.statusCode = 200;
    res.setHeader('cache-control', 'no-store');
    res.json(snapshot);
  } catch (error) {
    console.error(error);
    res.statusCode = 500;
    res.json({
      error: error instanceof Error ? error.message : 'Failed to load dashboard data',
    });
  }
}
