import { FormEvent, useEffect, useState } from 'react';
import { DashboardPage } from '../../components/layout/dashboard-page';
import { useToast } from '../../components/providers/toast-provider';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { FieldLabel } from '../../components/ui/field-label';
import { Input } from '../../components/ui/input';
import { Modal } from '../../components/ui/modal';
import { Select } from '../../components/ui/select';
import { Table, Td, Th } from '../../components/ui/table';
import { Textarea } from '../../components/ui/textarea';
import { useLocale } from '../../hooks/use-locale';
import { formatDate } from '../../lib/format';
import { jsonFetch } from '../../lib/http';
import { t } from '../../lib/i18n';
import { AppItem, AuthUser, ChannelItem } from '../../lib/types';

export default function SettingsPage() {
  const { locale } = useLocale();
  return (
    <DashboardPage title={t(locale, 'settings.title')} subtitle={t(locale, 'settings.subtitle')}>
      {({ appSlug, userRole }) => <SettingsContent activeAppSlug={appSlug} userRole={userRole} />}
    </DashboardPage>
  );
}

function SettingsContent({
  activeAppSlug,
  userRole,
}: {
  activeAppSlug: string;
  userRole: 'admin' | 'viewer';
}) {
  const { locale } = useLocale();
  const toast = useToast();
  const copy =
    locale === 'fa'
      ? {
          singleAppMode: 'حالت تک‌اپلیکیشن برای این سرور فعال است.',
          appLabel: 'اپ',
          defaultAppName: 'اپ پیش‌فرض',
          updateUrlsByChannel: 'لینک‌های آپدیت بر اساس کانال',
          noChannels: 'هنوز کانالی وجود ندارد.',
          codeSigningTitle: 'امضای کد (اختیاری)',
          codeSigningDesc:
            'تنظیم امضا برای اپ فعلی. اگر کلید خالی باشد، از تنظیم سراسری محیط استفاده می‌شود.',
          keyConfigured: 'کلید تنظیم شده',
          noAppKey: 'کلید اپ تنظیم نشده',
          keyIdLabel: 'شناسه کلید',
          keyIdHint: 'باید با updates.codeSigningMetadata.keyid در کلاینت یکسان باشد.',
          privateKeyLabel: 'کلید خصوصی (PEM)',
          privateKeyHint: 'اختیاری. برای افزودن یا چرخش کلید، PEM را Paste کنید.',
          saveSigning: 'ذخیره تنظیمات امضا',
          clearAppKey: 'حذف کلید اپ',
          signingSaved: 'تنظیمات امضا ذخیره شد.',
          keyRemoved: 'کلید خصوصی حذف شد.',
          permissionScope: 'سطح دسترسی',
          fullAccess: 'دسترسی کامل به انتشار، تنظیمات و عملیات',
          readOnly: 'فقط مشاهده داشبورد و گزارش‌ها',
          lastRefreshed: 'آخرین بروزرسانی',
          createUserSuccess: 'کاربر جدید ایجاد شد.',
          changePasswordTitle: 'تغییر رمز عبور',
          changePasswordDesc: 'رمز عبور حساب فعلی خود را تغییر دهید.',
          currentPassword: 'رمز عبور فعلی',
          currentPasswordHint: 'برای تایید هویت لازم است.',
          newPassword: 'رمز عبور جدید',
          newPasswordHint: 'حداقل ۸ کاراکتر.',
          updatePassword: 'بروزرسانی رمز',
          passwordUpdated: 'رمز عبور بروزرسانی شد.',
          usernameHint: 'نام کاربری حساب جدید.',
          passwordHint: 'رمز عبور اولیه کاربر.',
          roleHint: 'سطح دسترسی کاربر.',
          saving: 'در حال ذخیره...',
          clearing: 'در حال حذف...',
          creating: 'در حال ایجاد...',
          updating: 'در حال بروزرسانی...',
        }
      : {
          singleAppMode: 'Single-app mode is enabled for this server.',
          appLabel: 'App',
          defaultAppName: 'Default App',
          updateUrlsByChannel: 'Update URLs by channel',
          noChannels: 'No channels exist yet.',
          codeSigningTitle: 'Code Signing (optional)',
          codeSigningDesc:
            'Configure signing for the single app. If key is empty, signing falls back to global env config.',
          keyConfigured: 'Key configured',
          noAppKey: 'No app key',
          keyIdLabel: 'Key ID',
          keyIdHint: 'Must match updates.codeSigningMetadata.keyid in the client app.',
          privateKeyLabel: 'Private Key (PEM)',
          privateKeyHint: 'Optional. Paste PEM here to add or rotate key.',
          saveSigning: 'Save Signing Settings',
          clearAppKey: 'Clear App Key',
          signingSaved: 'Code signing settings saved.',
          keyRemoved: 'Private key removed.',
          permissionScope: 'Permission Scope',
          fullAccess: 'Full access to releases, settings, and operations',
          readOnly: 'Read-only access to dashboard and logs',
          lastRefreshed: 'Last refreshed',
          createUserSuccess: 'User created successfully.',
          changePasswordTitle: 'Change Password',
          changePasswordDesc: 'Update the password for your current account.',
          currentPassword: 'Current Password',
          currentPasswordHint: 'Required to verify your identity.',
          newPassword: 'New Password',
          newPasswordHint: 'Minimum 8 characters.',
          updatePassword: 'Update Password',
          passwordUpdated: 'Password updated.',
          usernameHint: 'Username for the new account.',
          passwordHint: 'Initial password for the user.',
          roleHint: 'Access level for the user.',
          saving: 'Saving...',
          clearing: 'Clearing...',
          creating: 'Creating...',
          updating: 'Updating...',
        };
  const [app, setApp] = useState<AppItem | null>(null);
  const [channels, setChannels] = useState<ChannelItem[]>([]);
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [signingKeyId, setSigningKeyId] = useState('main');
  const [signingPrivateKeyPem, setSigningPrivateKeyPem] = useState('');
  const [savingSigning, setSavingSigning] = useState(false);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'viewer'>('viewer');
  const [creatingUser, setCreatingUser] = useState(false);
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    void load();
  }, [activeAppSlug, userRole]);

  async function load(): Promise<void> {
    try {
      const [appResp, channelResp] = await Promise.all([
        jsonFetch<{ items: AppItem[] }>('/api/admin/apps'),
        jsonFetch<{ channels: ChannelItem[] }>('/api/admin/channels'),
      ]);
      setApp(appResp.items[0] ?? null);
      setChannels(channelResp.channels);
      setSigningKeyId(appResp.items[0]?.codeSigningKeyId || 'main');
      setSigningPrivateKeyPem('');
      if (userRole === 'admin') {
        const userResp = await jsonFetch<{ items: AuthUser[] }>('/api/admin/users');
        setUsers(userResp.items);
      }
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t(locale, 'settings.failedLoad'));
    }
  }

  async function handleSaveSigning(event: FormEvent): Promise<void> {
    event.preventDefault();
    try {
      setSavingSigning(true);
      const payload: Record<string, unknown> = {
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
      toast.success(copy.signingSaved);
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
          clearCodeSigningPrivateKey: true,
        }),
      });
      await load();
      toast.success(copy.keyRemoved);
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : t(locale, 'settings.failedLoad');
      setError(message);
      toast.error(message);
    } finally {
      setSavingSigning(false);
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
      toast.success(copy.createUserSuccess);
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : t(locale, 'settings.failedLoad');
      setError(message);
      toast.error(message);
    } finally {
      setCreatingUser(false);
    }
  }

  async function handleChangePassword(event: FormEvent): Promise<void> {
    event.preventDefault();
    try {
      setChangingPassword(true);
      await jsonFetch('/api/admin/users', {
        method: 'PATCH',
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });
      setCurrentPassword('');
      setNewPassword('');
      toast.success(copy.passwordUpdated);
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : t(locale, 'settings.failedLoad');
      setError(message);
      toast.error(message);
    } finally {
      setChangingPassword(false);
    }
  }

  function buildManifestUrl(channelName: string): string {
    const origin = typeof window === 'undefined' ? '' : window.location.origin;
    return `${origin}/api/manifest?channel=${encodeURIComponent(channelName)}`;
  }

  return (
    <div className="space-y-4">
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>{t(locale, 'settings.apps.title')}</CardTitle>
          <CardDescription>{copy.singleAppMode}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <Badge variant="muted">{copy.appLabel}</Badge>
            <span className="font-medium">{app?.name ?? copy.defaultAppName}</span>
            <span className="text-muted-foreground">({activeAppSlug})</span>
          </div>

          <div className="space-y-2 rounded-md border border-border/70 bg-muted/40 p-3">
            <p className="text-sm font-medium">{copy.updateUrlsByChannel}</p>
            {channels.length === 0 ? (
              <p className="text-xs text-muted-foreground">{copy.noChannels}</p>
            ) : (
              <div className="space-y-2">
                {channels.map((channel) => (
                  <div key={channel.id} className="rounded border border-border bg-white px-2 py-2 text-xs">
                    <div className="mb-1 font-medium">{channel.name}</div>
                    <p className="break-all rounded border border-border bg-muted px-2 py-1">
                      {buildManifestUrl(channel.name)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {userRole === 'admin' ? (
            <div className="space-y-3 rounded-md border border-border/70 bg-muted/40 p-3">
              <div>
                <p className="text-sm font-medium">{copy.codeSigningTitle}</p>
                <p className="text-xs text-muted-foreground">{copy.codeSigningDesc}</p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <Badge variant={app?.hasCodeSigningPrivateKey ? 'success' : 'muted'}>
                  {app?.hasCodeSigningPrivateKey ? copy.keyConfigured : copy.noAppKey}
                </Badge>
              </div>
              <form className="space-y-3" onSubmit={(event) => void handleSaveSigning(event)}>
                <div className="space-y-1">
                  <FieldLabel label={copy.keyIdLabel} hint={copy.keyIdHint} />
                  <Input value={signingKeyId} onChange={(event) => setSigningKeyId(event.target.value)} placeholder="main" />
                </div>
                <div className="space-y-1">
                  <FieldLabel label={copy.privateKeyLabel} hint={copy.privateKeyHint} />
                  <Textarea
                    value={signingPrivateKeyPem}
                    onChange={(event) => setSigningPrivateKeyPem(event.target.value)}
                    placeholder="-----BEGIN PRIVATE KEY-----"
                    className="min-h-32 font-mono text-xs"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button type="submit" loading={savingSigning} loadingText={copy.saving}>
                    {copy.saveSigning}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void handleClearSigningKey()}
                    loading={savingSigning}
                    loadingText={copy.clearing}
                  >
                    {copy.clearAppKey}
                  </Button>
                </div>
              </form>
            </div>
          ) : null}
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
                  <Th>{copy.permissionScope}</Th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <Td>{user.id}</Td>
                    <Td>{user.username}</Td>
                    <Td>{t(locale, `shell.role.${user.role}`)}</Td>
                    <Td>{user.role === 'admin' ? copy.fullAccess : copy.readOnly}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
          {users.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              {copy.lastRefreshed}: {formatDate(new Date().toISOString(), locale)}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{copy.changePasswordTitle}</CardTitle>
          <CardDescription>{copy.changePasswordDesc}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-3" onSubmit={(event) => void handleChangePassword(event)}>
            <div className="space-y-1">
              <FieldLabel label={copy.currentPassword} hint={copy.currentPasswordHint} />
              <Input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                placeholder={copy.currentPassword}
                required
              />
            </div>
            <div className="space-y-1">
              <FieldLabel label={copy.newPassword} hint={copy.newPasswordHint} />
              <Input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder={copy.newPassword}
                required
              />
            </div>
            <div className="self-end">
              <Button type="submit" loading={changingPassword} loadingText={copy.updating}>
                {copy.updatePassword}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

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
              <FieldLabel label={t(locale, 'settings.users.username')} hint={copy.usernameHint} />
              <Input value={username} onChange={(event) => setUsername(event.target.value)} placeholder={t(locale, 'settings.users.username')} required />
            </div>
            <div className="space-y-1">
              <FieldLabel label={t(locale, 'settings.users.password')} hint={copy.passwordHint} />
              <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder={t(locale, 'settings.users.password')} required />
            </div>
            <div className="space-y-1">
              <FieldLabel label={t(locale, 'settings.users.role')} hint={copy.roleHint} />
              <Select value={role} onChange={(event) => setRole(event.target.value as 'admin' | 'viewer')}>
                <option value="viewer">{t(locale, 'settings.users.roleViewer')}</option>
                <option value="admin">{t(locale, 'settings.users.roleAdmin')}</option>
              </Select>
            </div>
            <div className="self-end">
              <Button type="submit" loading={creatingUser} loadingText={copy.creating}>
                {t(locale, 'settings.users.create')}
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
