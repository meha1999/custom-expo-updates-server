import { NextApiRequest, NextApiResponse } from 'next';
import { getAuthenticatedUser } from '../../../common/auth';

export default function meEndpoint(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Expected GET.' });
    return;
  }

  const user = getAuthenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  res.status(200).json({ user });
}

