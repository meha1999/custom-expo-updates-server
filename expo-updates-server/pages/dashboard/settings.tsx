import { FormEvent, useEffect, useState } from 'react';
import { DashboardPage } from '../../components/layout/dashboard-page';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { FieldLabel } from '../../components/ui/field-label';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { Table, Td, Th } from '../../components/ui/table';
import { useLocale } from '../../hooks/use-locale';
import { jsonFetch } from '../../lib/http';
import { t } from '../../lib/i18n';
import { AppItem, AuthUser, ChannelItem } from '../../lib/types';

export default function SettingsPage() {
  const { locale } = useLocale();
  return (
    <DashboardPage
      title={t(locale, 'settings.title')}
      subtitle={t(locale, 'settings.subtitle')}
    >
      {({ appSlug, userRole, setApp, refreshApps }) => (
        <SettingsContent
          activeAppSlug={appSlug}
          userRole={userRole}
          setApp={setApp}
          refreshApps={refreshApps}
        />
      )}
    </DashboardPage>
  );
}

function SettingsContent({
  activeAppSlug,
  userRole,
  setApp,
  refreshApps,
}: {
  activeAppSlug: string;
  userRole: 'admin' | 'viewer';
  setApp: (slug: string) => Promise<void>;
  refreshApps: () => Promise<void>;
}) {
  const { locale } = useLocale();
  const [apps, setApps] = useState<AppItem[]>([]);
  const [channels, setChannels] = useState<ChannelItem[]>([]);
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [createdApp, setCreatedApp] = useState<AppItem | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [appName, setAppName] = useState('');
  const [appSlugInput, setAppSlugInput] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'viewer'>('viewer');
  const hints =
    locale === 'fa'
      ? {
          appName: 'نام نمایشی اپ در پنل مدیریت.',
          appSlug: 'شناسه یکتا برای اپ که در API و فیلترها استفاده می‌شود.',
          username: 'نام کاربری حساب جدید برای ورود به داشبورد.',
          password: 'رمز عبور اولیه کاربر جدید.',
          role: 'سطح دسترسی کاربر. مدیر دسترسی کامل دارد، مشاهده‌گر فقط خواندن.',
        }
      : {
          appName: 'Display name of the app in the management panel.',
          appSlug: 'Unique app identifier used in API calls and filtering.',
          username: 'Username for the new dashboard account.',
          password: 'Initial password for the new user.',
          role: 'Access level. Admin has full access, viewer is read-only.',
        };

  useEffect(() => {
    void load();
  }, [activeAppSlug, userRole, locale]);

  async function load(): Promise<void> {
    try {
      const [appResp, channelResp] = await Promise.all([
        jsonFetch<{ items: AppItem[] }>('/api/admin/apps'),
        jsonFetch<{ channels: ChannelItem[] }>(
          `/api/admin/channels?app=${encodeURIComponent(activeAppSlug)}`,
        ),
      ]);
      setApps(appResp.items);
      setChannels(channelResp.channels);
      if (userRole === 'admin') {
        const userResp = await jsonFetch<{ items: AuthUser[] }>('/api/admin/users');
        setUsers(userResp.items);
      }
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t(locale, 'settings.failedLoad'));
    }
  }

  async function handleCreateApp(event: FormEvent): Promise<void> {
    event.preventDefault();
    try {
      const created = await jsonFetch<AppItem>('/api/admin/apps', {
        method: 'POST',
        body: JSON.stringify({ name: appName, slug: appSlugInput || undefined }),
      });
      setCreatedApp(created);
      setCopiedKey(null);
      setAppName('');
      setAppSlugInput('');
      await load();
      await refreshApps();
      await setApp(created.slug);
      const createdChannels = await jsonFetch<{ channels: ChannelItem[] }>(
        `/api/admin/channels?app=${encodeURIComponent(created.slug)}`,
      );
      setChannels(createdChannels.channels);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t(locale, 'settings.failedLoad'));
    }
  }

  async function handleCreateUser(event: FormEvent): Promise<void> {
    event.preventDefault();
    try {
      await jsonFetch('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({ username, password, role }),
      });
      setUsername('');
      setPassword('');
      await load();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t(locale, 'settings.failedLoad'));
    }
  }

  function buildManifestUrl(targetAppSlug: string, channelName: string): string {
    const origin = typeof window === 'undefined' ? '' : window.location.origin;
    return `${origin}/api/manifest?app=${encodeURIComponent(targetAppSlug)}&channel=${encodeURIComponent(channelName)}`;
  }

  const manifestUrl = createdApp ? buildManifestUrl(createdApp.slug, 'production') : null;

  async function copyValue(value: string, key: string): Promise<void> {
    if (!value || typeof navigator === 'undefined') {
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
    } catch {
      setCopiedKey(null);
    }
  }

  return (
    <div className="space-y-4">
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>{t(locale, 'settings.apps.title')}</CardTitle>
          <CardDescription>{t(locale, 'settings.apps.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {userRole === 'admin' ? (
            <form className="grid gap-3 md:grid-cols-3" onSubmit={(event) => void handleCreateApp(event)}>
              <div className="space-y-1">
                <FieldLabel label={t(locale, 'settings.apps.appName')} hint={hints.appName} />
                <Input value={appName} onChange={(event) => setAppName(event.target.value)} placeholder={t(locale, 'settings.apps.appName')} required />
              </div>
              <div className="space-y-1">
                <FieldLabel label={t(locale, 'settings.apps.appSlug')} hint={hints.appSlug} />
                <Input
                  value={appSlugInput}
                  onChange={(event) => setAppSlugInput(event.target.value)}
                  placeholder={t(locale, 'settings.apps.appSlug')}
                />
              </div>
              <Button type="submit" className="self-end">{t(locale, 'settings.apps.create')}</Button>
            </form>
          ) : null}
          {createdApp && manifestUrl ? (
            <div className="space-y-2 rounded-md border border-success/30 bg-success/10 p-3">
              <p className="text-sm font-medium text-success">
                {locale === 'fa'
                  ? `آدرس آپدیت برای اپ ${createdApp.name} آماده است`
                  : `Update URL for ${createdApp.name} is ready`}
              </p>
              <p className="break-all rounded border border-border bg-white px-2 py-1 text-xs">
                {manifestUrl}
              </p>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => void copyValue(manifestUrl, 'created')}>
                  {locale === 'fa' ? 'کپی URL' : 'Copy URL'}
                </Button>
                {copiedKey === 'created' ? (
                  <span className="text-xs text-success">
                    {locale === 'fa' ? 'کپی شد' : 'Copied'}
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                {locale === 'fa'
                  ? 'این مقدار را داخل app.json در مسیر updates.url قرار دهید.'
                  : 'Paste this value into app.json as updates.url.'}
              </p>
            </div>
          ) : null}
          <div className="space-y-2 rounded-md border border-border/70 bg-muted/40 p-3">
            <p className="text-sm font-medium">
              {locale === 'fa'
                ? `URL آپدیت برای کانال‌های اپ ${activeAppSlug}`
                : `Update URLs for ${activeAppSlug} channels`}
            </p>
            {channels.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                {locale === 'fa' ? 'برای این اپ هنوز کانالی ثبت نشده است.' : 'No channels exist for this app yet.'}
              </p>
            ) : (
              <div className="space-y-2">
                {channels.map((channel) => {
                  const channelUrl = buildManifestUrl(activeAppSlug, channel.name);
                  const copyKey = `channel-${channel.id}`;
                  return (
                    <div
                      key={channel.id}
                      className="rounded border border-border bg-white px-2 py-2 text-xs"
                    >
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="font-medium">{channel.name}</span>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void copyValue(channelUrl, copyKey)}
                          >
                            {locale === 'fa' ? 'کپی URL' : 'Copy URL'}
                          </Button>
                          {copiedKey === copyKey ? (
                            <span className="text-success">{locale === 'fa' ? 'کپی شد' : 'Copied'}</span>
                          ) : null}
                        </div>
                      </div>
                      <p className="break-all rounded border border-border bg-muted px-2 py-1">
                        {channelUrl}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {locale === 'fa'
                ? 'برای هر محیط، URL کانال مناسب را داخل updates.url در اپ قرار دهید.'
                : 'Use the matching channel URL in your app updates.url for each environment.'}
            </p>
          </div>
          <div className="overflow-auto">
            <Table>
              <thead>
                <tr>
                  <Th>{t(locale, 'settings.apps.id')}</Th>
                  <Th>{t(locale, 'settings.apps.name')}</Th>
                  <Th>{t(locale, 'settings.apps.slug')}</Th>
                </tr>
              </thead>
              <tbody>
                {apps.map((app) => (
                  <tr key={app.id}>
                    <Td>{app.id}</Td>
                    <Td>{app.name}</Td>
                    <Td>{app.slug}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t(locale, 'settings.users.title')}</CardTitle>
          <CardDescription>{t(locale, 'settings.users.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {userRole === 'admin' ? (
            <form className="grid gap-3 md:grid-cols-4" onSubmit={(event) => void handleCreateUser(event)}>
              <div className="space-y-1">
                <FieldLabel label={t(locale, 'settings.users.username')} hint={hints.username} />
                <Input value={username} onChange={(event) => setUsername(event.target.value)} placeholder={t(locale, 'settings.users.username')} required />
              </div>
              <div className="space-y-1">
                <FieldLabel label={t(locale, 'settings.users.password')} hint={hints.password} />
                <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder={t(locale, 'settings.users.password')} required />
              </div>
              <div className="space-y-1">
                <FieldLabel label={t(locale, 'settings.users.role')} hint={hints.role} />
                <Select value={role} onChange={(event) => setRole(event.target.value as 'admin' | 'viewer')}>
                  <option value="viewer">{t(locale, 'settings.users.roleViewer')}</option>
                  <option value="admin">{t(locale, 'settings.users.roleAdmin')}</option>
                </Select>
              </div>
              <Button type="submit" className="self-end">{t(locale, 'settings.users.create')}</Button>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">{t(locale, 'settings.users.viewerReadOnly')}</p>
          )}
          <div className="overflow-auto">
            <Table>
              <thead>
                <tr>
                  <Th>{t(locale, 'settings.users.id')}</Th>
                  <Th>{t(locale, 'settings.users.username')}</Th>
                  <Th>{t(locale, 'settings.users.role')}</Th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <Td>{user.id}</Td>
                    <Td>{user.username}</Td>
                    <Td>{t(locale, `shell.role.${user.role}`)}</Td>
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
