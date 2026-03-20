import Link from 'next/link';
import { useRouter } from 'next/router';
import { ReactNode, useMemo, useState } from 'react';
import { useLocale } from '../../hooks/use-locale';
import { t } from '../../lib/i18n';
import type { Locale } from '../../lib/i18n';
import { AppItem, AuthUser } from '../../lib/types';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { FieldLabel } from '../ui/field-label';
import { Select } from '../ui/select';

interface DashboardShellProps {
  user: AuthUser;
  title: string;
  subtitle?: string;
  appSlug: string;
  apps: AppItem[];
  onChangeApp: (slug: string) => Promise<void>;
  onLogout: () => Promise<void>;
  children: ReactNode;
}

interface NavItem {
  labelKey: string;
  href: string;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { labelKey: 'shell.nav.overview', href: '/dashboard' },
  { labelKey: 'shell.nav.releases', href: '/dashboard/releases' },
  { labelKey: 'shell.nav.channels', href: '/dashboard/channels' },
  { labelKey: 'shell.nav.devices', href: '/dashboard/devices' },
  { labelKey: 'shell.nav.logs', href: '/dashboard/logs' },
  { labelKey: 'shell.nav.apiKeys', href: '/dashboard/api-keys', adminOnly: true },
  { labelKey: 'shell.nav.settings', href: '/dashboard/settings' },
];

export function DashboardShell({
  user,
  title,
  subtitle,
  appSlug,
  apps,
  onChangeApp,
  onLogout,
  children,
}: DashboardShellProps) {
  const router = useRouter();
  const { locale, isRtl, setLocale } = useLocale();
  const [mobileOpen, setMobileOpen] = useState(false);
  const hints =
    locale === 'fa'
      ? {
          activeApp:
            'با تغییر اپ فعال، همه آمار، لاگ‌ها و عملیات انتشار برای همان اپ نمایش داده می‌شود.',
          language: 'زبان رابط کاربری داشبورد را تغییر می‌دهد.',
        }
      : {
          activeApp:
            'Changing active app switches all stats, logs, and release operations to that app scope.',
          language: 'Changes the dashboard interface language.',
        };

  const visibleNav = useMemo(
    () => navItems.filter((item) => !item.adminOnly || user.role === 'admin'),
    [user.role],
  );

  const navQuery = appSlug ? `?app=${encodeURIComponent(appSlug)}` : '';

  return (
    <div className="min-h-screen">
      {mobileOpen ? (
        <button
          className="fixed inset-0 z-30 bg-black/20 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label={t(locale, 'shell.closeMenu')}
        />
      ) : null}
      <div className="mx-auto flex max-w-[1440px]">
        <aside
          className={cn(
            'fixed inset-y-0 z-40 w-64 border-border bg-white p-4 transition-transform md:static md:translate-x-0',
            isRtl ? 'right-0 border-l md:border-r-0' : 'left-0 border-r md:border-l-0',
            mobileOpen
              ? 'translate-x-0'
              : isRtl
                ? 'translate-x-full md:translate-x-0'
                : '-translate-x-full md:translate-x-0',
          )}
        >
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Expo</p>
              <p className="text-lg font-semibold">{t(locale, 'shell.brandTitle')}</p>
            </div>
            <button
              className="text-sm text-muted-foreground md:hidden"
              onClick={() => setMobileOpen(false)}
              aria-label={t(locale, 'shell.closeMenu')}
            >
              {t(locale, 'shell.closeMenu')}
            </button>
          </div>

          <div className="mb-4 rounded-lg border border-border bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground">{t(locale, 'shell.signedInAs')}</p>
            <p className="text-sm font-medium">{user.username}</p>
            <p className="text-xs text-muted-foreground">{t(locale, `shell.role.${user.role}`)}</p>
          </div>

          <nav className="space-y-1">
            {visibleNav.map((item) => {
              const active = router.pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={`${item.href}${navQuery}`}
                  className={cn(
                    'block rounded-md px-3 py-2 text-sm transition',
                    active
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                  onClick={() => setMobileOpen(false)}
                >
                  {t(locale, item.labelKey)}
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="min-h-screen flex-1 p-4 md:p-6">
          <header className="mb-5 rounded-xl border border-border bg-white p-4 shadow-soft">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h1 className="text-xl font-semibold md:text-2xl">{title}</h1>
                {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
              </div>
              <button
                className="text-sm text-muted-foreground md:hidden"
                onClick={() => setMobileOpen(true)}
                aria-label={t(locale, 'shell.openMenu')}
              >
                {t(locale, 'shell.openMenu')}
              </button>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="min-w-[180px] space-y-1">
                  <FieldLabel label={t(locale, 'shell.activeApp')} hint={hints.activeApp} />
                  <Select value={appSlug} onChange={(event) => void onChangeApp(event.target.value)}>
                    {apps.map((app) => (
                      <option key={app.id} value={app.slug}>
                        {app.name} ({app.slug})
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[130px] space-y-1">
                  <FieldLabel label={t(locale, 'shell.language')} hint={hints.language} />
                  <Select
                    value={locale}
                    onChange={(event) => setLocale(event.target.value as Locale)}
                    aria-label={t(locale, 'shell.language')}
                  >
                    <option value="en">{t(locale, 'shell.english')}</option>
                    <option value="fa">{t(locale, 'shell.persian')}</option>
                  </Select>
                </div>
                <Button variant="outline" className="self-end" onClick={() => void onLogout()}>
                  {t(locale, 'shell.logout')}
                </Button>
              </div>
            </div>
          </header>

          {children}
        </main>
      </div>
    </div>
  );
}
