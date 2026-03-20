import { useEffect, useMemo, useState } from 'react';
import { DashboardPage } from '../../components/layout/dashboard-page';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
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
      {({ appSlug }) => <DevicesContent appSlug={appSlug} />}
    </DashboardPage>
  );
}

function DevicesContent({ appSlug }: { appSlug: string }) {
  const { locale } = useLocale();
  const [payload, setPayload] = useState<DashboardPayload | null>(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const data = await jsonFetch<DashboardPayload>(
          `/api/dashboard?app=${encodeURIComponent(appSlug)}&limit=80`,
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
  }, [appSlug, locale]);

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
                  <Th>{t(locale, 'devices.inventory.platform')}</Th>
                  <Th>{t(locale, 'devices.inventory.runtime')}</Th>
                  <Th>{t(locale, 'devices.inventory.appVersion')}</Th>
                  <Th>{t(locale, 'devices.inventory.channel')}</Th>
                  <Th>{t(locale, 'devices.inventory.requests')}</Th>
                  <Th>{t(locale, 'devices.inventory.lastSeen')}</Th>
                </tr>
              </thead>
              <tbody>
                {filteredDevices.map((device) => (
                  <tr key={device.id}>
                    <Td>{device.deviceId}</Td>
                    <Td>
                      <Badge variant="muted">{device.platform ?? t(locale, 'devices.inventory.unknown')}</Badge>
                    </Td>
                    <Td>{device.runtimeVersion ?? '-'}</Td>
                    <Td>{device.appVersion ?? '-'}</Td>
                    <Td>{device.channelName ?? '-'}</Td>
                    <Td>{device.totalRequests}</Td>
                    <Td>{formatDate(device.lastSeen, locale)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
