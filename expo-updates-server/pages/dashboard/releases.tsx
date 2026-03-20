import { FormEvent, useEffect, useState } from 'react';
import { DashboardPage } from '../../components/layout/dashboard-page';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Table, Td, Th } from '../../components/ui/table';
import { Textarea } from '../../components/ui/textarea';
import { useLocale } from '../../hooks/use-locale';
import { jsonFetch } from '../../lib/http';
import { formatDate, parseListInput } from '../../lib/format';
import { t } from '../../lib/i18n';
import { DashboardPayload, ReleaseItem } from '../../lib/types';

export default function ReleasesPage() {
  const { locale } = useLocale();
  return (
    <DashboardPage
      title={t(locale, 'releases.title')}
      subtitle={t(locale, 'releases.subtitle')}
    >
      {({ appSlug, userRole }) => <ReleasesContent appSlug={appSlug} userRole={userRole} />}
    </DashboardPage>
  );
}

function ReleasesContent({ appSlug, userRole }: { appSlug: string; userRole: 'admin' | 'viewer' }) {
  const { locale } = useLocale();
  const [runtimeVersion, setRuntimeVersion] = useState('1');
  const [bundleId, setBundleId] = useState('');
  const [channelName, setChannelName] = useState('production');
  const [rolloutPercentage, setRolloutPercentage] = useState(100);
  const [allowlist, setAllowlist] = useState('');
  const [blocklist, setBlocklist] = useState('');

  const [sourceChannel, setSourceChannel] = useState('staging');
  const [targetChannel, setTargetChannel] = useState('production');
  const [rollbackChannel, setRollbackChannel] = useState('production');

  const [releases, setReleases] = useState<ReleaseItem[]>([]);
  const [audit, setAudit] = useState<DashboardPayload['recentAuditLogs']>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void loadData();
  }, [appSlug, locale]);

  async function loadData(): Promise<void> {
    try {
      const [releaseResp, dashboardResp] = await Promise.all([
        jsonFetch<{ items: ReleaseItem[] }>(`/api/admin/releases?app=${encodeURIComponent(appSlug)}`),
        jsonFetch<DashboardPayload>(`/api/dashboard?app=${encodeURIComponent(appSlug)}&limit=40`),
      ]);
      setReleases(releaseResp.items);
      setAudit(dashboardResp.recentAuditLogs);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t(locale, 'releases.failedLoad'));
    }
  }

  async function handleRegisterRelease(event: FormEvent): Promise<void> {
    event.preventDefault();
    try {
      await jsonFetch('/api/admin/releases', {
        method: 'POST',
        body: JSON.stringify({
          appSlug,
          runtimeVersion,
          bundleId,
          channelName,
          rolloutPercentage,
          allowlist: parseListInput(allowlist),
          blocklist: parseListInput(blocklist),
        }),
      });
      setBundleId('');
      setMessage(t(locale, 'releases.successRegister'));
      await loadData();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t(locale, 'releases.failedLoad'));
    }
  }

  async function handlePromote(event: FormEvent): Promise<void> {
    event.preventDefault();
    try {
      await jsonFetch('/api/admin/promote', {
        method: 'POST',
        body: JSON.stringify({
          appSlug,
          sourceChannelName: sourceChannel,
          targetChannelName: targetChannel,
          runtimeVersion,
        }),
      });
      setMessage(t(locale, 'releases.successPromote'));
      await loadData();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t(locale, 'releases.failedLoad'));
    }
  }

  async function handleRollback(event: FormEvent): Promise<void> {
    event.preventDefault();
    try {
      await jsonFetch('/api/admin/rollback', {
        method: 'POST',
        body: JSON.stringify({
          appSlug,
          channelName: rollbackChannel,
          runtimeVersion,
        }),
      });
      setMessage(t(locale, 'releases.successRollback'));
      await loadData();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t(locale, 'releases.failedLoad'));
    }
  }

  return (
    <div className="space-y-4">
      {error ? (
        <Card>
          <CardContent className="py-3 text-sm text-danger">{error}</CardContent>
        </Card>
      ) : null}
      {message ? (
        <Card>
          <CardContent className="py-3 text-sm text-success">{message}</CardContent>
        </Card>
      ) : null}

      {userRole === 'admin' ? (
        <section className="grid gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle>{t(locale, 'releases.register.title')}</CardTitle>
              <CardDescription>{t(locale, 'releases.register.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="grid gap-3 md:grid-cols-2" onSubmit={(event) => void handleRegisterRelease(event)}>
                <Input value={runtimeVersion} onChange={(event) => setRuntimeVersion(event.target.value)} placeholder={t(locale, 'releases.register.runtimeVersion')} required />
                <Input value={bundleId} onChange={(event) => setBundleId(event.target.value)} placeholder={t(locale, 'releases.register.bundleId')} required />
                <Input value={channelName} onChange={(event) => setChannelName(event.target.value)} placeholder={t(locale, 'releases.register.channel')} required />
                <Input type="number" min={0} max={100} value={rolloutPercentage} onChange={(event) => setRolloutPercentage(Number(event.target.value))} placeholder={t(locale, 'releases.register.rollout')} required />
                <Textarea value={allowlist} onChange={(event) => setAllowlist(event.target.value)} placeholder={t(locale, 'releases.register.allowlist')} className="md:col-span-2" />
                <Textarea value={blocklist} onChange={(event) => setBlocklist(event.target.value)} placeholder={t(locale, 'releases.register.blocklist')} className="md:col-span-2" />
                <div className="md:col-span-2">
                  <Button type="submit">{t(locale, 'releases.register.button')}</Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t(locale, 'releases.ops.title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <form className="space-y-2" onSubmit={(event) => void handlePromote(event)}>
                <Input value={sourceChannel} onChange={(event) => setSourceChannel(event.target.value)} placeholder={t(locale, 'releases.ops.sourceChannel')} required />
                <Input value={targetChannel} onChange={(event) => setTargetChannel(event.target.value)} placeholder={t(locale, 'releases.ops.targetChannel')} required />
                <Button type="submit" variant="secondary">{t(locale, 'releases.ops.promoteButton')}</Button>
              </form>
              <form className="space-y-2" onSubmit={(event) => void handleRollback(event)}>
                <Input value={rollbackChannel} onChange={(event) => setRollbackChannel(event.target.value)} placeholder={t(locale, 'releases.ops.rollbackChannel')} required />
                <Button type="submit" variant="destructive">{t(locale, 'releases.ops.rollbackButton')}</Button>
              </form>
            </CardContent>
          </Card>
        </section>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t(locale, 'releases.recent.title')}</CardTitle>
          </CardHeader>
          <CardContent className="overflow-auto">
            <Table>
              <thead>
                <tr>
                  <Th>{t(locale, 'releases.recent.id')}</Th>
                  <Th>{t(locale, 'releases.recent.runtime')}</Th>
                  <Th>{t(locale, 'releases.recent.bundle')}</Th>
                  <Th>{t(locale, 'releases.recent.type')}</Th>
                  <Th>{t(locale, 'releases.recent.created')}</Th>
                </tr>
              </thead>
              <tbody>
                {releases.slice(0, 30).map((release) => (
                  <tr key={release.id}>
                    <Td>{release.id}</Td>
                    <Td>{release.runtimeVersion}</Td>
                    <Td>{release.bundleId}</Td>
                    <Td>
                      <Badge variant={release.isRollback ? 'warning' : 'default'}>
                        {release.isRollback
                          ? t(locale, 'releases.recent.rollback')
                          : t(locale, 'releases.recent.update')}
                      </Badge>
                    </Td>
                    <Td>{formatDate(release.createdAt, locale)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t(locale, 'releases.audit.title')}</CardTitle>
          </CardHeader>
          <CardContent className="overflow-auto">
            <Table>
              <thead>
                <tr>
                  <Th>{t(locale, 'releases.audit.time')}</Th>
                  <Th>{t(locale, 'releases.audit.actor')}</Th>
                  <Th>{t(locale, 'releases.audit.action')}</Th>
                </tr>
              </thead>
              <tbody>
                {audit.slice(0, 30).map((entry) => (
                  <tr key={entry.id}>
                    <Td>{formatDate(entry.timestamp, locale)}</Td>
                    <Td>{entry.actorUsername}</Td>
                    <Td>
                      <div className="space-y-1">
                        <Badge variant="muted">{entry.action}</Badge>
                        <p className="text-xs text-muted-foreground">{entry.detailsJson}</p>
                      </div>
                    </Td>
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
