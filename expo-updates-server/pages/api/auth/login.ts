import { NextApiRequest, NextApiResponse } from 'next';
import { authenticateUser } from '../../../common/controlPlaneDb';
import { setSessionCookie } from '../../../common/auth';

const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

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

  try {
    const session = authenticateUser(username, password);
    setSessionCookie(res, session.token, SESSION_MAX_AGE_SECONDS);
    res.status(200).json({
      user: session.user,
      expiresAt: session.expiresAt,
    });
  } catch (error) {
    res.status(401).json({
      error: error instanceof Error ? error.message : 'Login failed',
    });
  }
}

