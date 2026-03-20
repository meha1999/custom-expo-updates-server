import { NextApiRequest, NextApiResponse } from 'next';
import { clearSessionCookie, getSessionTokenFromRequest } from '../../../common/auth';
import { invalidateSession } from '../../../common/controlPlaneDb';

export default function logoutEndpoint(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Expected POST.' });
    return;
  }

  const token = getSessionTokenFromRequest(req);
  if (token) {
    invalidateSession(token);
  }
  clearSessionCookie(res);
  res.status(200).json({ ok: true });
}

