import { useEffect, useState } from 'react';
import { DashboardPage } from '../../components/layout/dashboard-page';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Table, Td, Th } from '../../components/ui/table';
import { useLocale } from '../../hooks/use-locale';
import { StatCard, StatLabel, StatValue } from '../../components/ui/stat';
import { jsonFetch } from '../../lib/http';
import { t } from '../../lib/i18n';
import { DashboardPayload } from '../../lib/types';
import { formatDate } from '../../lib/format';

export default function DashboardOverviewPage() {
  const { locale } = useLocale();
  return (
    <DashboardPage
      title={t(locale, 'overview.title')}
      subtitle={t(locale, 'overview.subtitle')}
    >
      {({ appSlug }) => <OverviewContent appSlug={appSlug} />}
    </DashboardPage>
  );
}

function OverviewContent({ appSlug }: { appSlug: string }) {
  const { locale } = useLocale();
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const payload = await jsonFetch<DashboardPayload>(
          `/api/dashboard?app=${encodeURIComponent(appSlug)}&limit=120`,
        );
        if (!active) return;
        setData(payload);
        setError(null);
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : t(locale, 'overview.failedLoad'));
      }
    }

    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 12000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [appSlug, locale]);

  const totalPlatforms =
    (data?.platformBreakdown.ios ?? 0) +
    (data?.platformBreakdown.android ?? 0) +
    (data?.platformBreakdown.unknown ?? 0);

  return (
    <div className="space-y-4">
      {error ? (
        <Card>
          <CardContent className="py-3">
            <p className="text-sm text-danger">{error}</p>
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard>
          <StatLabel>{t(locale, 'overview.stats.totalEvents')}</StatLabel>
          <StatValue>{data?.summary.totalEvents ?? 0}</StatValue>
        </StatCard>
        <StatCard>
          <StatLabel>{t(locale, 'overview.stats.devices')}</StatLabel>
          <StatValue>{data?.summary.uniqueDevices ?? 0}</StatValue>
        </StatCard>
        <StatCard>
          <StatLabel>{t(locale, 'overview.stats.updatesServed')}</StatLabel>
          <StatValue>{data?.summary.updateResponses ?? 0}</StatValue>
        </StatCard>
        <StatCard>
          <StatLabel>{t(locale, 'overview.stats.errors')}</StatLabel>
          <StatValue>{data?.summary.errorResponses ?? 0}</StatValue>
        </StatCard>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t(locale, 'overview.platform.title')}</CardTitle>
            <CardDescription>{t(locale, 'overview.platform.description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <PlatformBar
              label={t(locale, 'overview.platform.ios')}
              value={data?.platformBreakdown.ios ?? 0}
              total={totalPlatforms}
              colorClass="bg-primary"
            />
            <PlatformBar
              label={t(locale, 'overview.platform.android')}
              value={data?.platformBreakdown.android ?? 0}
              total={totalPlatforms}
              colorClass="bg-success"
            />
            <PlatformBar
              label={t(locale, 'overview.platform.unknown')}
              value={data?.platformBreakdown.unknown ?? 0}
              total={totalPlatforms}
              colorClass="bg-warning"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t(locale, 'overview.delivery.title')}</CardTitle>
            <CardDescription>{t(locale, 'overview.delivery.description')}</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <HealthItem label={t(locale, 'overview.delivery.manifest')} value={data?.summary.manifestRequests ?? 0} />
            <HealthItem label={t(locale, 'overview.delivery.assets')} value={data?.summary.assetRequests ?? 0} />
            <HealthItem label={t(locale, 'overview.delivery.ackSuccess')} value={data?.summary.ackSuccess ?? 0} />
            <HealthItem label={t(locale, 'overview.delivery.ackFailed')} value={data?.summary.ackFailures ?? 0} danger />
            <HealthItem label={t(locale, 'overview.delivery.rollbacks')} value={data?.summary.rollbackResponses ?? 0} />
            <HealthItem label={t(locale, 'overview.delivery.noUpdate')} value={data?.summary.noUpdateResponses ?? 0} />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>{t(locale, 'overview.recentEvents.title')}</CardTitle>
          </CardHeader>
          <CardContent className="overflow-auto">
            <Table>
              <thead>
                <tr>
                  <Th>{t(locale, 'overview.recentEvents.time')}</Th>
                  <Th>{locale === 'fa' ? 'برنامه/کانال' : 'App/Channel'}</Th>
                  <Th>{t(locale, 'overview.recentEvents.event')}</Th>
                  <Th>{locale === 'fa' ? 'Runtime/پلتفرم' : 'Runtime/Platform'}</Th>
                  <Th>{locale === 'fa' ? 'دستگاه' : 'Device'}</Th>
                  <Th>{t(locale, 'overview.recentEvents.status')}</Th>
                </tr>
              </thead>
              <tbody>
                {(data?.recentEvents ?? []).slice(0, 12).map((item) => (
                  <tr key={item.id}>
                    <Td>{formatDate(item.timestamp, locale)}</Td>
                    <Td>
                      <div className="space-y-1">
                        <span className="font-medium">{item.appSlug}</span>
                        <div>
                          <Badge variant="muted">{item.channelName ?? '-'}</Badge>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <div className="flex flex-col gap-1">
                        <span>{item.eventType}</span>
                        <span className="text-xs text-muted-foreground">{item.requestPath}</span>
                      </div>
                    </Td>
                    <Td>
                      <div className="space-y-1">
                        <span>{item.runtimeVersion ?? '-'}</span>
                        <span className="block text-xs text-muted-foreground">{item.platform ?? '-'}</span>
                      </div>
                    </Td>
                    <Td>
                      <span className="font-mono text-xs">{item.deviceId}</span>
                    </Td>
                    <Td>
                      <Badge variant={item.status >= 400 ? 'danger' : 'success'}>{item.status}</Badge>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t(locale, 'overview.recentReleases.title')}</CardTitle>
          </CardHeader>
          <CardContent className="overflow-auto">
            <Table>
              <thead>
                <tr>
                  <Th>{t(locale, 'overview.recentReleases.runtime')}</Th>
                  <Th>{t(locale, 'overview.recentReleases.bundle')}</Th>
                  <Th>{locale === 'fa' ? 'Manifest ID' : 'Manifest ID'}</Th>
                  <Th>{t(locale, 'overview.recentReleases.type')}</Th>
                  <Th>{locale === 'fa' ? 'ایجاد شده در' : 'Created At'}</Th>
                </tr>
              </thead>
              <tbody>
                {(data?.recentUpdates ?? []).slice(0, 12).map((item) => (
                  <tr key={item.id}>
                    <Td>{item.runtimeVersion}</Td>
                    <Td>{item.bundleId}</Td>
                    <Td>
                      <span className="font-mono text-xs">{item.manifestId ?? '-'}</span>
                    </Td>
                    <Td>
                      <Badge variant={item.isRollback ? 'warning' : 'default'}>
                        {item.isRollback
                          ? t(locale, 'overview.recentReleases.rollback')
                          : t(locale, 'overview.recentReleases.update')}
                      </Badge>
                    </Td>
                    <Td>{formatDate(item.createdAt, locale)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function PlatformBar({
  label,
  value,
  total,
  colorClass,
}: {
  label: string;
  value: number;
  total: number;
  colorClass: string;
}) {
  const pct = total === 0 ? 0 : Math.round((value / total) * 100);
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span>{label}</span>
        <span className="text-muted-foreground">{pct}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className={`h-full ${colorClass}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function HealthItem({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={danger ? 'mt-1 text-xl font-semibold text-danger' : 'mt-1 text-xl font-semibold'}>{value}</p>
    </div>
  );
}
