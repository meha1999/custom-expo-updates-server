import { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '../../../common/auth';
import { exportRequestLogsCsv, listRequestLogs } from '../../../common/controlPlaneDb';
import { SINGLE_APP_SLUG } from '../../../common/singleApp';

function getQueryValue(value: string | string[] | undefined): string | undefined {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value) && value.length > 0) {
    return value[0];
  }
  return undefined;
}

export default function logsEndpoint(req: NextApiRequest, res: NextApiResponse) {
  const user = requireAuth(req, res);
  if (!user) {
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Expected GET.' });
    return;
  }

  const channelName = getQueryValue(req.query.channelName);
  const eventType = getQueryValue(req.query.eventType);
  const status = getQueryValue(req.query.status);
  const search = getQueryValue(req.query.search);
  const page = Number(getQueryValue(req.query.page) ?? '1');
  const pageSize = Number(getQueryValue(req.query.pageSize) ?? '50');
  const format = getQueryValue(req.query.format);

  if (format === 'csv') {
    const csv = exportRequestLogsCsv({
      appSlug: SINGLE_APP_SLUG,
      channelName,
      eventType,
      status: status ? Number(status) : undefined,
      search,
    });
    res.status(200);
    res.setHeader('content-type', 'text/csv; charset=utf-8');
    res.setHeader('content-disposition', 'attachment; filename="request-logs.csv"');
    res.send(csv);
    return;
  }

  const result = listRequestLogs({
    appSlug: SINGLE_APP_SLUG,
    channelName,
    eventType,
    status: status ? Number(status) : undefined,
    search,
    page,
    pageSize,
  });
  res.status(200).json(result);
}
