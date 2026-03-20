import { useEffect, useMemo, useState } from 'react';
import { DashboardPage } from '../../components/layout/dashboard-page';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { FieldLabel } from '../../components/ui/field-label';
import { Input } from '../../components/ui/input';
import { Table, Td, Th } from '../../components/ui/table';
import { useToast } from '../../components/providers/toast-provider';
import { useLocale } from '../../hooks/use-locale';
import { jsonFetch } from '../../lib/http';
import { formatDate } from '../../lib/format';
import { t } from '../../lib/i18n';
import { LogResponse } from '../../lib/types';

const PAGE_SIZE = 20;

export default function LogsPage() {
  const { locale } = useLocale();
  return (
    <DashboardPage title={t(locale, 'logs.title')} subtitle={t(locale, 'logs.subtitle')}>
      {({ appSlug }) => <LogsContent appSlug={appSlug} />}
    </DashboardPage>
  );
}

function LogsContent({ appSlug }: { appSlug: string }) {
  const { locale } = useLocale();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [eventType, setEventType] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<LogResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const hints =
    locale === 'fa'
      ? {
          search: 'جستجو در مسیر درخواست، پیام و شناسه دستگاه برای پیدا کردن رویدادهای خاص.',
          eventType: 'نمایش فقط یک نوع رویداد مثل manifest.request یا telemetry.ack.',
          status: 'فقط لاگ‌هایی با کد وضعیت HTTP مشخص‌شده را نمایش می‌دهد.',
        }
      : {
          search: 'Search request path, message, and device ID to find specific events.',
          eventType: 'Show only one event type such as manifest.request or telemetry.ack.',
          status: 'Filter logs by a specific HTTP status code.',
        };

  useEffect(() => {
    void load(false);
  }, [appSlug, search, eventType, status, page, locale]);

  async function load(showSuccessToast: boolean): Promise<void> {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        app: appSlug,
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (search) params.set('search', search);
      if (eventType) params.set('eventType', eventType);
      if (status) params.set('status', status);
      const payload = await jsonFetch<LogResponse>(`/api/admin/logs?${params.toString()}`);
      setData(payload);
      setError(null);
      if (showSuccessToast) {
        toast.info(locale === 'fa' ? 'لاگ‌ها به‌روزرسانی شدند.' : 'Logs refreshed.');
      }
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : t(locale, 'logs.failedLoad');
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  const exportUrl = useMemo(() => {
    const params = new URLSearchParams({
      app: appSlug,
      format: 'csv',
    });
    if (search) params.set('search', search);
    if (eventType) params.set('eventType', eventType);
    if (status) params.set('status', status);
    return `/api/admin/logs?${params.toString()}`;
  }, [appSlug, search, eventType, status]);

  return (
    <div className="space-y-4">
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>{t(locale, 'logs.filters.title')}</CardTitle>
          <CardDescription>{t(locale, 'logs.filters.description')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <div className="space-y-1">
            <FieldLabel label={t(locale, 'logs.filters.search')} hint={hints.search} />
            <Input value={search} onChange={(event) => { setPage(1); setSearch(event.target.value); }} placeholder={t(locale, 'logs.filters.search')} />
          </div>
          <div className="space-y-1">
            <FieldLabel label={t(locale, 'logs.filters.eventType')} hint={hints.eventType} />
            <Input value={eventType} onChange={(event) => { setPage(1); setEventType(event.target.value); }} placeholder={t(locale, 'logs.filters.eventType')} />
          </div>
          <div className="space-y-1">
            <FieldLabel label={t(locale, 'logs.filters.statusCode')} hint={hints.status} />
            <Input value={status} onChange={(event) => { setPage(1); setStatus(event.target.value); }} placeholder={t(locale, 'logs.filters.statusCode')} />
          </div>
          <div className="flex items-end gap-2 pb-0.5">
            <a href={exportUrl} className="text-sm text-primary underline underline-offset-4">{t(locale, 'logs.filters.exportCsv')}</a>
            <Button
              variant="outline"
              onClick={() => void load(true)}
              loading={loading}
              loadingText={locale === 'fa' ? 'در حال به‌روزرسانی...' : 'Refreshing...'}
            >
              {t(locale, 'logs.filters.refresh')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t(locale, 'logs.table.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto">
            <Table>
              <thead>
                <tr>
                  <Th>{locale === 'fa' ? 'شناسه' : 'ID'}</Th>
                  <Th>{t(locale, 'logs.table.time')}</Th>
                  <Th>{locale === 'fa' ? 'اپ' : 'App'}</Th>
                  <Th>{t(locale, 'logs.table.event')}</Th>
                  <Th>{t(locale, 'logs.table.status')}</Th>
                  <Th>{t(locale, 'logs.table.channel')}</Th>
                  <Th>{t(locale, 'logs.table.runtime')}</Th>
                  <Th>{t(locale, 'logs.table.device')}</Th>
                  <Th>{t(locale, 'logs.table.message')}</Th>
                </tr>
              </thead>
              <tbody>
                {(data?.items ?? []).map((row) => (
                  <tr key={row.id}>
                    <Td>
                      <span className="font-mono text-xs">{row.id}</span>
                    </Td>
                    <Td>{formatDate(row.timestamp, locale)}</Td>
                    <Td>{row.app_slug}</Td>
                    <Td>
                      <div className="space-y-1">
                        <span>{row.event_type}</span>
                        <span className="block text-xs text-muted-foreground">
                          {row.method} {row.request_path}
                        </span>
                      </div>
                    </Td>
                    <Td>
                      <Badge variant={row.status >= 400 ? 'danger' : 'success'}>{row.status}</Badge>
                    </Td>
                    <Td>{row.channel_name ?? '-'}</Td>
                    <Td>{row.runtime_version ?? '-'}</Td>
                    <Td>
                      <span className="font-mono text-xs">{row.device_id}</span>
                    </Td>
                    <Td>
                      <span className="text-xs text-muted-foreground">{row.message ?? '-'}</span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {t(locale, 'logs.pagination.showing', {
                shown: (data?.items ?? []).length,
                total: data?.total ?? 0,
              })}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={(data?.page ?? 1) <= 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>
                {t(locale, 'logs.pagination.prev')}
              </Button>
              <span className="text-xs">{t(locale, 'logs.pagination.page', { page: data?.page ?? 1 })}</span>
              <Button
                variant="outline"
                size="sm"
                disabled={(data?.page ?? 1) * PAGE_SIZE >= (data?.total ?? 0)}
                onClick={() => setPage((prev) => prev + 1)}
              >
                {t(locale, 'logs.pagination.next')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
