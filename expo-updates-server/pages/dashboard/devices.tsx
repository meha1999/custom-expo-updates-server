import { useEffect, useMemo, useState } from 'react';
import { DashboardPage } from '../../components/layout/dashboard-page';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { FieldLabel } from '../../components/ui/field-label';
import { Input } from '../../components/ui/input';
import { Table, Td, Th } from '../../components/ui/table';
import { useLocale } from '../../hooks/use-locale';
import { jsonFetch } from '../../lib/http';
import { formatDate } from '../../lib/format';
import { t } from '../../lib/i18n';
import { DashboardPayload } from '../../lib/types';

export default function DevicesPage() {
  const { locale } = useLocale();
  return (
    <DashboardPage
      title={t(locale, 'devices.title')}
      subtitle={t(locale, 'devices.subtitle')}
    >
      {() => <DevicesContent />}
    </DashboardPage>
  );
}

function DevicesContent() {
  const { locale } = useLocale();
  const [payload, setPayload] = useState<DashboardPayload | null>(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const searchHint =
    locale === 'fa'
      ? 'دستگاه‌ها را با شناسه دستگاه، نسخه اپ، ران‌تایم یا کانال فیلتر می‌کند.'
      : 'Filters devices by device ID, app version, runtime version, or channel.';

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const data = await jsonFetch<DashboardPayload>(
          '/api/dashboard?limit=80',
        );
        if (!active) return;
        setPayload(data);
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : t(locale, 'devices.failedLoad'));
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [locale]);

  const filteredDevices = useMemo(() => {
    const rows = payload?.devices ?? [];
    if (!search.trim()) {
      return rows;
    }
    const term = search.toLowerCase();
    return rows.filter(
      (item) =>
        item.deviceId.toLowerCase().includes(term) ||
        (item.runtimeVersion ?? '').toLowerCase().includes(term) ||
        (item.appVersion ?? '').toLowerCase().includes(term) ||
        (item.channelName ?? '').toLowerCase().includes(term),
    );
  }, [payload?.devices, search]);

  return (
    <div className="space-y-4">
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>{t(locale, 'devices.inventory.title')}</CardTitle>
          <CardDescription>{t(locale, 'devices.inventory.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-3 max-w-sm">
            <FieldLabel label={t(locale, 'logs.filters.search')} hint={searchHint} />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t(locale, 'devices.inventory.search')}
            />
          </div>
          <div className="overflow-auto">
            <Table>
              <thead>
                <tr>
                  <Th>{t(locale, 'devices.inventory.device')}</Th>
                  <Th>{locale === 'fa' ? 'اپ' : 'App'}</Th>
                  <Th>{t(locale, 'devices.inventory.platform')}</Th>
                  <Th>{t(locale, 'devices.inventory.runtime')}</Th>
                  <Th>{t(locale, 'devices.inventory.appVersion')}</Th>
                  <Th>{t(locale, 'devices.inventory.channel')}</Th>
                  <Th>{t(locale, 'devices.inventory.requests')}</Th>
                  <Th>{locale === 'fa' ? 'اولین مشاهده' : 'First Seen'}</Th>
                  <Th>{t(locale, 'devices.inventory.lastSeen')}</Th>
                  <Th>{locale === 'fa' ? 'وضعیت فعالیت' : 'Activity'}</Th>
                </tr>
              </thead>
              <tbody>
                {filteredDevices.map((device) => {
                  const lastSeenTime = new Date(device.lastSeen).getTime();
                  const ageHours =
                    Number.isNaN(lastSeenTime) ? Number.POSITIVE_INFINITY : (Date.now() - lastSeenTime) / 36e5;
                  const activity =
                    ageHours <= 24
                      ? {
                          label: locale === 'fa' ? 'فعال' : 'Active',
                          variant: 'success' as const,
                        }
                      : ageHours <= 24 * 7
                        ? {
                            label: locale === 'fa' ? 'کم‌فعال' : 'Low',
                            variant: 'warning' as const,
                          }
                        : {
                            label: locale === 'fa' ? 'غیرفعال' : 'Inactive',
                            variant: 'muted' as const,
                          };

                  return (
                    <tr key={device.id}>
                      <Td>
                        <span className="font-mono text-xs">{device.deviceId}</span>
                      </Td>
                      <Td>{device.appSlug}</Td>
                      <Td>
                        <Badge variant="muted">{device.platform ?? t(locale, 'devices.inventory.unknown')}</Badge>
                      </Td>
                      <Td>{device.runtimeVersion ?? '-'}</Td>
                      <Td>{device.appVersion ?? '-'}</Td>
                      <Td>{device.channelName ?? '-'}</Td>
                      <Td>{device.totalRequests}</Td>
                      <Td>{formatDate(device.firstSeen, locale)}</Td>
                      <Td>{formatDate(device.lastSeen, locale)}</Td>
                      <Td>
                        <Badge variant={activity.variant}>{activity.label}</Badge>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
