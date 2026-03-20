import { FormEvent, useEffect, useState } from 'react';
import { DashboardPage } from '../../components/layout/dashboard-page';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { FieldLabel } from '../../components/ui/field-label';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
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
  const hints =
    locale === 'fa'
      ? {
          createChannel: 'نام کانال جدید برای ساخت استریم انتشار مجزا.',
          policyChannel: 'کانالی که سیاست ران‌تایم روی آن اعمال می‌شود.',
          runtimeVersion: 'نسخه ران‌تایمی که سیاست برای آن تعریف می‌شود.',
          activeReleaseId: 'شناسه نسخه فعال. خالی بماند یعنی نسخه فعال حذف شود.',
          rollout: 'درصد دستگاه‌های واجد شرایط برای دریافت آپدیت این سیاست.',
          allowlist: 'در صورت مقداردهی، فقط همین Device IDها اجازه دریافت دارند.',
          blocklist: 'Device IDهای این لیست هرگز این آپدیت را دریافت نمی‌کنند.',
          rollback: 'اگر فعال باشد دستگاه‌ها به نسخه embedded اپ برمی‌گردند.',
        }
      : {
          createChannel: 'Name of a new channel to create a separate release stream.',
          policyChannel: 'Channel where this runtime policy will be applied.',
          runtimeVersion: 'Runtime version this policy is scoped to.',
          activeReleaseId: 'Active release ID. Leave empty to clear current assignment.',
          rollout: 'Percentage of eligible devices that can receive this policy update.',
          allowlist: 'If set, only these device IDs can receive this update.',
          blocklist: 'Device IDs in this list are always excluded from this update.',
          rollback: 'When enabled, devices are instructed to roll back to embedded update.',
        };

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

  const channelOptions = Array.from(
    new Set([
      ...channels.map((channel) => channel.name),
      'production',
      'development',
    ]),
  );

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
              <form className="grid gap-2 sm:grid-cols-[1fr_auto]" onSubmit={(event) => void handleCreateChannel(event)}>
                <div className="space-y-1">
                  <FieldLabel label={t(locale, 'channels.create.placeholder')} hint={hints.createChannel} />
                  <Input value={newChannelName} onChange={(event) => setNewChannelName(event.target.value)} placeholder={t(locale, 'channels.create.placeholder')} required />
                </div>
                <Button type="submit" className="self-end">{t(locale, 'channels.create.button')}</Button>
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
                <div className="space-y-1">
                  <FieldLabel label={t(locale, 'channels.policy.channelName')} hint={hints.policyChannel} />
                  <Select value={policyChannelName} onChange={(event) => setPolicyChannelName(event.target.value)}>
                    {channelOptions.map((channel) => (
                      <option key={`policy-${channel}`} value={channel}>
                        {channel}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1">
                  <FieldLabel label={t(locale, 'channels.policy.runtimeVersion')} hint={hints.runtimeVersion} />
                  <Input value={policyRuntimeVersion} onChange={(event) => setPolicyRuntimeVersion(event.target.value)} placeholder={t(locale, 'channels.policy.runtimeVersion')} required />
                </div>
                <div className="space-y-1">
                  <FieldLabel label={t(locale, 'channels.policy.activeReleaseId')} hint={hints.activeReleaseId} />
                  <Input value={policyActiveReleaseId} onChange={(event) => setPolicyActiveReleaseId(event.target.value)} placeholder={t(locale, 'channels.policy.activeReleaseId')} />
                </div>
                <div className="space-y-1">
                  <FieldLabel label={t(locale, 'channels.policy.rollout')} hint={hints.rollout} />
                  <Input type="number" min={0} max={100} value={policyRollout} onChange={(event) => setPolicyRollout(Number(event.target.value))} placeholder={t(locale, 'channels.policy.rollout')} required />
                </div>
                <div className="space-y-1">
                  <FieldLabel label={t(locale, 'channels.policy.allowlist')} hint={hints.allowlist} />
                  <Textarea value={policyAllowlist} onChange={(event) => setPolicyAllowlist(event.target.value)} placeholder={t(locale, 'channels.policy.allowlist')} />
                </div>
                <div className="space-y-1">
                  <FieldLabel label={t(locale, 'channels.policy.blocklist')} hint={hints.blocklist} />
                  <Textarea value={policyBlocklist} onChange={(event) => setPolicyBlocklist(event.target.value)} placeholder={t(locale, 'channels.policy.blocklist')} />
                </div>
                <div className="space-y-1">
                  <FieldLabel label={t(locale, 'channels.policy.rollback')} hint={hints.rollback} />
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={policyRollback} onChange={(event) => setPolicyRollback(event.target.checked)} />
                    {t(locale, 'channels.policy.rollback')}
                  </label>
                </div>
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
