import { FormEvent, useEffect, useState } from 'react';
import { DashboardPage } from '../../components/layout/dashboard-page';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { FieldLabel } from '../../components/ui/field-label';
import { Input } from '../../components/ui/input';
import { Modal } from '../../components/ui/modal';
import { Select } from '../../components/ui/select';
import { Table, Td, Th } from '../../components/ui/table';
import { Textarea } from '../../components/ui/textarea';
import { useToast } from '../../components/providers/toast-provider';
import { useLocale } from '../../hooks/use-locale';
import { formatDate } from '../../lib/format';
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
  const toast = useToast();
  const [apps, setApps] = useState<AppItem[]>([]);
  const [channels, setChannels] = useState<ChannelItem[]>([]);
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [createdApp, setCreatedApp] = useState<AppItem | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [appName, setAppName] = useState('');
  const [appSlugInput, setAppSlugInput] = useState('');
  const [signingKeyId, setSigningKeyId] = useState('main');
  const [signingPrivateKeyPem, setSigningPrivateKeyPem] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'viewer'>('viewer');
  const [creatingApp, setCreatingApp] = useState(false);
  const [savingSigning, setSavingSigning] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [showCreateAppModal, setShowCreateAppModal] = useState(false);
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
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

  useEffect(() => {
    const activeApp = apps.find((app) => app.slug === activeAppSlug);
    setSigningKeyId(activeApp?.codeSigningKeyId || 'main');
    setSigningPrivateKeyPem('');
  }, [apps, activeAppSlug]);

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
      setCreatingApp(true);
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
      setShowCreateAppModal(false);
      toast.success(locale === 'fa' ? 'اپ جدید با موفقیت ایجاد شد.' : 'App created successfully.');
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : t(locale, 'settings.failedLoad');
      setError(message);
      toast.error(message);
    } finally {
      setCreatingApp(false);
    }
  }

  async function handleCreateUser(event: FormEvent): Promise<void> {
    event.preventDefault();
    try {
      setCreatingUser(true);
      await jsonFetch('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({ username, password, role }),
      });
      setUsername('');
      setPassword('');
      await load();
      setShowCreateUserModal(false);
      toast.success(locale === 'fa' ? 'کاربر جدید ایجاد شد.' : 'User created successfully.');
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : t(locale, 'settings.failedLoad');
      setError(message);
      toast.error(message);
    } finally {
      setCreatingUser(false);
    }
  }

  async function handleSaveSigning(event: FormEvent): Promise<void> {
    event.preventDefault();
    try {
      setSavingSigning(true);
      const payload: Record<string, unknown> = {
        appSlug: activeAppSlug,
        codeSigningKeyId: signingKeyId || 'main',
      };
      if (signingPrivateKeyPem.trim()) {
        payload.codeSigningPrivateKeyPem = signingPrivateKeyPem;
      }
      await jsonFetch<AppItem>('/api/admin/apps', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      await load();
      await refreshApps();
      setSigningPrivateKeyPem('');
      toast.success(locale === 'fa' ? 'تنظیمات امضای کد ذخیره شد.' : 'Code signing settings saved.');
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : t(locale, 'settings.failedLoad');
      setError(message);
      toast.error(message);
    } finally {
      setSavingSigning(false);
    }
  }

  async function handleClearSigningKey(): Promise<void> {
    try {
      setSavingSigning(true);
      await jsonFetch<AppItem>('/api/admin/apps', {
        method: 'PATCH',
        body: JSON.stringify({
          appSlug: activeAppSlug,
          clearCodeSigningPrivateKey: true,
        }),
      });
      await load();
      await refreshApps();
      setSigningPrivateKeyPem('');
      toast.success(locale === 'fa' ? 'کلید خصوصی این اپ حذف شد.' : 'Private key removed for this app.');
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : t(locale, 'settings.failedLoad');
      setError(message);
      toast.error(message);
    } finally {
      setSavingSigning(false);
    }
  }

  function buildManifestUrl(targetAppSlug: string, channelName: string): string {
    const origin = typeof window === 'undefined' ? '' : window.location.origin;
    return `${origin}/api/manifest?app=${encodeURIComponent(targetAppSlug)}&channel=${encodeURIComponent(channelName)}`;
  }

  const manifestUrl = createdApp ? buildManifestUrl(createdApp.slug, 'production') : null;
  const activeApp = apps.find((app) => app.slug === activeAppSlug);

  async function copyValue(value: string, key: string): Promise<void> {
    if (!value || typeof navigator === 'undefined') {
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      toast.success(locale === 'fa' ? 'URL کپی شد.' : 'URL copied.');
    } catch {
      setCopiedKey(null);
      toast.error(locale === 'fa' ? 'کپی URL انجام نشد.' : 'Failed to copy URL.');
    }
  }

  return (
    <div className="space-y-4">
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>{t(locale, 'settings.apps.title')}</CardTitle>
            <CardDescription>{t(locale, 'settings.apps.description')}</CardDescription>
          </div>
          {userRole === 'admin' ? (
            <Button type="button" onClick={() => setShowCreateAppModal(true)}>
              {t(locale, 'settings.apps.create')}
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-3">
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
          {userRole === 'admin' ? (
            <div className="space-y-3 rounded-md border border-border/70 bg-muted/40 p-3">
              <div>
                <p className="text-sm font-medium">Code Signing (optional)</p>
                <p className="text-xs text-muted-foreground">
                  Store a PEM private key for the active app. If empty, signing only uses global PRIVATE_KEY_PATH.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <Badge variant={activeApp?.hasCodeSigningPrivateKey ? 'success' : 'muted'}>
                  {activeApp?.hasCodeSigningPrivateKey ? 'App key configured' : 'No app key'}
                </Badge>
                <span className="text-muted-foreground">Active app: {activeAppSlug}</span>
              </div>
              <form className="space-y-3" onSubmit={(event) => void handleSaveSigning(event)}>
                <div className="space-y-1">
                  <FieldLabel
                    label="Key ID"
                    hint="Must match updates.codeSigningMetadata.keyid in the client app."
                  />
                  <Input
                    value={signingKeyId}
                    onChange={(event) => setSigningKeyId(event.target.value)}
                    placeholder="main"
                  />
                </div>
                <div className="space-y-1">
                  <FieldLabel
                    label="Private Key (PEM)"
                    hint="Optional. Paste PEM here to add or rotate the app key."
                  />
                  <Textarea
                    value={signingPrivateKeyPem}
                    onChange={(event) => setSigningPrivateKeyPem(event.target.value)}
                    placeholder="-----BEGIN PRIVATE KEY-----"
                    className="min-h-32 font-mono text-xs"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button type="submit" loading={savingSigning} loadingText="Saving...">
                    Save Signing Settings
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void handleClearSigningKey()}
                    loading={savingSigning}
                    loadingText="Clearing..."
                  >
                    Clear App Key
                  </Button>
                </div>
              </form>
            </div>
          ) : null}
          <div className="overflow-auto">
            <Table>
              <thead>
                <tr>
                  <Th>{t(locale, 'settings.apps.id')}</Th>
                  <Th>{t(locale, 'settings.apps.name')}</Th>
                  <Th>{t(locale, 'settings.apps.slug')}</Th>
                  <Th>{locale === 'fa' ? 'وضعیت' : 'Status'}</Th>
                  <Th>{locale === 'fa' ? 'ایجاد شده' : 'Created'}</Th>
                  <Th>{locale === 'fa' ? 'URL تولید' : 'Production URL'}</Th>
                </tr>
              </thead>
              <tbody>
                {apps.map((app) => {
                  const productionUrl = buildManifestUrl(app.slug, 'production');
                  const isActive = app.slug === activeAppSlug;
                  return (
                    <tr key={app.id}>
                      <Td>{app.id}</Td>
                      <Td>{app.name}</Td>
                      <Td>{app.slug}</Td>
                      <Td>
                        <Badge variant={isActive ? 'success' : 'muted'}>
                          {isActive
                            ? locale === 'fa'
                              ? 'فعال'
                              : 'Active'
                            : locale === 'fa'
                              ? 'غیرفعال'
                              : 'Inactive'}
                        </Badge>
                      </Td>
                      <Td>{formatDate(app.createdAt, locale)}</Td>
                      <Td>
                        <span className="break-all text-xs text-muted-foreground">{productionUrl || '-'}</span>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>{t(locale, 'settings.users.title')}</CardTitle>
            <CardDescription>{t(locale, 'settings.users.description')}</CardDescription>
          </div>
          {userRole === 'admin' ? (
            <Button type="button" onClick={() => setShowCreateUserModal(true)}>
              {t(locale, 'settings.users.create')}
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="overflow-auto">
            <Table>
              <thead>
                <tr>
                  <Th>{t(locale, 'settings.users.id')}</Th>
                  <Th>{t(locale, 'settings.users.username')}</Th>
                  <Th>{t(locale, 'settings.users.role')}</Th>
                  <Th>{locale === 'fa' ? 'سطح دسترسی' : 'Permission Scope'}</Th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <Td>{user.id}</Td>
                    <Td>{user.username}</Td>
                    <Td>{t(locale, `shell.role.${user.role}`)}</Td>
                    <Td>
                      {user.role === 'admin'
                        ? locale === 'fa'
                          ? 'دسترسی کامل به انتشار، تنظیمات و عملیات'
                          : 'Full access to releases, settings, and operations'
                        : locale === 'fa'
                          ? 'فقط مشاهده داشبورد و گزارش‌ها'
                          : 'Read-only access to dashboard and logs'}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {userRole === 'admin' ? (
        <Modal
          open={showCreateAppModal}
          onClose={() => setShowCreateAppModal(false)}
          title={t(locale, 'settings.apps.create')}
          description={t(locale, 'settings.apps.description')}
          widthClassName="max-w-3xl"
        >
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
            <div className="self-end">
              <Button
                type="submit"
                loading={creatingApp}
                loadingText="Creating..."
              >
                {t(locale, 'settings.apps.create')}
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}

      {userRole === 'admin' ? (
        <Modal
          open={showCreateUserModal}
          onClose={() => setShowCreateUserModal(false)}
          title={t(locale, 'settings.users.create')}
          description={t(locale, 'settings.users.description')}
          widthClassName="max-w-3xl"
        >
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
            <div className="self-end">
              <Button
                type="submit"
                loading={creatingUser}
                loadingText="Creating..."
              >
                {t(locale, 'settings.users.create')}
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}

