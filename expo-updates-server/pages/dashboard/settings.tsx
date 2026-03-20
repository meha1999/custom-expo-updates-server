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
import { AppItem, AuthUser } from '../../lib/types';

export default function SettingsPage() {
  const { locale } = useLocale();
  return (
    <DashboardPage
      title={t(locale, 'settings.title')}
      subtitle={t(locale, 'settings.subtitle')}
    >
      {({ userRole }) => <SettingsContent userRole={userRole} />}
    </DashboardPage>
  );
}

function SettingsContent({ userRole }: { userRole: 'admin' | 'viewer' }) {
  const { locale } = useLocale();
  const [apps, setApps] = useState<AppItem[]>([]);
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [appName, setAppName] = useState('');
  const [appSlug, setAppSlug] = useState('');
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
  }, [userRole, locale]);

  async function load(): Promise<void> {
    try {
      const appResp = await jsonFetch<{ items: AppItem[] }>('/api/admin/apps');
      setApps(appResp.items);
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
      await jsonFetch('/api/admin/apps', {
        method: 'POST',
        body: JSON.stringify({ name: appName, slug: appSlug || undefined }),
      });
      setAppName('');
      setAppSlug('');
      await load();
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
                <Input value={appSlug} onChange={(event) => setAppSlug(event.target.value)} placeholder={t(locale, 'settings.apps.appSlug')} />
              </div>
              <Button type="submit">{t(locale, 'settings.apps.create')}</Button>
            </form>
          ) : null}
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
              <Button type="submit">{t(locale, 'settings.users.create')}</Button>
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
