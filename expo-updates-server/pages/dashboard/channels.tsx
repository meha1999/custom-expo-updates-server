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
import { parseListInput } from '../../lib/format';
import { t } from '../../lib/i18n';
import { ChannelItem, PolicyItem } from '../../lib/types';

export default function ChannelsPage() {
  const { locale } = useLocale();
  return (
    <DashboardPage
      title={t(locale, 'channels.title')}
      subtitle={t(locale, 'channels.subtitle')}
    >
      {({ appSlug, userRole }) => <ChannelsContent appSlug={appSlug} userRole={userRole} />}
    </DashboardPage>
  );
}

function ChannelsContent({ appSlug, userRole }: { appSlug: string; userRole: 'admin' | 'viewer' }) {
  const { locale } = useLocale();
  const [channels, setChannels] = useState<ChannelItem[]>([]);
  const [policies, setPolicies] = useState<PolicyItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [newChannelName, setNewChannelName] = useState('');

  const [policyChannelName, setPolicyChannelName] = useState('production');
  const [policyRuntimeVersion, setPolicyRuntimeVersion] = useState('1');
  const [policyActiveReleaseId, setPolicyActiveReleaseId] = useState('');
  const [policyRollout, setPolicyRollout] = useState(100);
  const [policyAllowlist, setPolicyAllowlist] = useState('');
  const [policyBlocklist, setPolicyBlocklist] = useState('');
  const [policyRollback, setPolicyRollback] = useState(false);

  useEffect(() => {
    void loadData();
  }, [appSlug, locale]);

  async function loadData(): Promise<void> {
    try {
      const payload = await jsonFetch<{ channels: ChannelItem[]; policies: PolicyItem[] }>(
        `/api/admin/channels?app=${encodeURIComponent(appSlug)}`,
      );
      setChannels(payload.channels);
      setPolicies(payload.policies);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t(locale, 'channels.failedLoad'));
    }
  }

  async function handleCreateChannel(event: FormEvent): Promise<void> {
    event.preventDefault();
    try {
      await jsonFetch('/api/admin/channels', {
        method: 'POST',
        body: JSON.stringify({
          appSlug,
          channelName: newChannelName,
        }),
      });
      setNewChannelName('');
      setMessage(t(locale, 'channels.successCreate'));
      await loadData();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t(locale, 'channels.failedLoad'));
    }
  }

  async function handlePolicyUpdate(event: FormEvent): Promise<void> {
    event.preventDefault();
    try {
      await jsonFetch('/api/admin/channels', {
        method: 'PUT',
        body: JSON.stringify({
          appSlug,
          channelName: policyChannelName,
          runtimeVersion: policyRuntimeVersion,
          activeReleaseId: policyActiveReleaseId.trim() ? Number(policyActiveReleaseId) : null,
          rolloutPercentage: policyRollout,
          allowlist: parseListInput(policyAllowlist),
          blocklist: parseListInput(policyBlocklist),
          rollbackToEmbedded: policyRollback,
        }),
      });
      setMessage(t(locale, 'channels.successPolicy'));
      await loadData();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t(locale, 'channels.failedLoad'));
    }
  }

  return (
    <div className="space-y-4">
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {message ? <p className="text-sm text-success">{message}</p> : null}

      {userRole === 'admin' ? (
        <section className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{t(locale, 'channels.create.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="flex items-center gap-2" onSubmit={(event) => void handleCreateChannel(event)}>
                <Input value={newChannelName} onChange={(event) => setNewChannelName(event.target.value)} placeholder={t(locale, 'channels.create.placeholder')} required />
                <Button type="submit">{t(locale, 'channels.create.button')}</Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t(locale, 'channels.policy.title')}</CardTitle>
              <CardDescription>{t(locale, 'channels.policy.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="grid gap-3" onSubmit={(event) => void handlePolicyUpdate(event)}>
                <Input value={policyChannelName} onChange={(event) => setPolicyChannelName(event.target.value)} placeholder={t(locale, 'channels.policy.channelName')} required />
                <Input value={policyRuntimeVersion} onChange={(event) => setPolicyRuntimeVersion(event.target.value)} placeholder={t(locale, 'channels.policy.runtimeVersion')} required />
                <Input value={policyActiveReleaseId} onChange={(event) => setPolicyActiveReleaseId(event.target.value)} placeholder={t(locale, 'channels.policy.activeReleaseId')} />
                <Input type="number" min={0} max={100} value={policyRollout} onChange={(event) => setPolicyRollout(Number(event.target.value))} placeholder={t(locale, 'channels.policy.rollout')} required />
                <Textarea value={policyAllowlist} onChange={(event) => setPolicyAllowlist(event.target.value)} placeholder={t(locale, 'channels.policy.allowlist')} />
                <Textarea value={policyBlocklist} onChange={(event) => setPolicyBlocklist(event.target.value)} placeholder={t(locale, 'channels.policy.blocklist')} />
                <label className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={policyRollback} onChange={(event) => setPolicyRollback(event.target.checked)} />
                  {t(locale, 'channels.policy.rollback')}
                </label>
                <Button type="submit">{t(locale, 'channels.policy.button')}</Button>
              </form>
            </CardContent>
          </Card>
        </section>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t(locale, 'channels.list.channelsTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="overflow-auto">
            <Table>
              <thead>
                <tr>
                  <Th>{t(locale, 'channels.list.id')}</Th>
                  <Th>{t(locale, 'channels.list.name')}</Th>
                </tr>
              </thead>
              <tbody>
                {channels.map((channel) => (
                  <tr key={channel.id}>
                    <Td>{channel.id}</Td>
                    <Td>{channel.name}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t(locale, 'channels.list.policiesTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="overflow-auto">
            <Table>
              <thead>
                <tr>
                  <Th>{t(locale, 'channels.list.channel')}</Th>
                  <Th>{t(locale, 'channels.list.runtime')}</Th>
                  <Th>{t(locale, 'channels.list.release')}</Th>
                  <Th>{t(locale, 'channels.list.rollout')}</Th>
                  <Th>{t(locale, 'channels.list.state')}</Th>
                </tr>
              </thead>
              <tbody>
                {policies.map((policy) => (
                  <tr key={policy.id}>
                    <Td>{policy.channelName}</Td>
                    <Td>{policy.runtimeVersion}</Td>
                    <Td>{policy.activeReleaseId ?? '-'}</Td>
                    <Td>{policy.rolloutPercentage}%</Td>
                    <Td>
                      {policy.rollbackToEmbedded ? (
                        <Badge variant="warning">{t(locale, 'channels.list.rollback')}</Badge>
                      ) : (
                        <Badge variant="success">{t(locale, 'channels.list.active')}</Badge>
                      )}
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
