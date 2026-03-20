import { ReactNode } from 'react';
import { useAppScope } from '../../hooks/use-app-scope';
import { useAuthGuard } from '../../hooks/use-auth-guard';
import { useLocale } from '../../hooks/use-locale';
import { t } from '../../lib/i18n';
import { DashboardShell } from './dashboard-shell';

interface DashboardPageProps {
  title: string;
  subtitle?: string;
  children: (context: { appSlug: string; userRole: 'admin' | 'viewer' }) => ReactNode;
}

export function DashboardPage({ title, subtitle, children }: DashboardPageProps) {
  const auth = useAuthGuard();
  const { locale } = useLocale();
  const appScope = useAppScope(!auth.loading && !!auth.user);

  if (auth.loading || !auth.user || appScope.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        {t(locale, 'dashboard.loading')}
      </div>
    );
  }

  return (
    <DashboardShell
      user={auth.user}
      title={title}
      subtitle={subtitle}
      appSlug={appScope.appSlug}
      apps={appScope.apps}
      onChangeApp={appScope.setApp}
      onLogout={auth.logout}
    >
      {children({ appSlug: appScope.appSlug, userRole: auth.user.role })}
    </DashboardShell>
  );
}
