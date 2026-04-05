import { useEffect, useState } from 'react';
import { DashboardPage } from '../../components/layout/dashboard-page';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Table, Td, Th } from '../../components/ui/table';
import { useLocale } from '../../hooks/use-locale';
import { formatDate } from '../../lib/format';
import { jsonFetch } from '../../lib/http';
import { t } from '../../lib/i18n';
import { SecurityPayload } from '../../lib/types';

export default function SecurityPage() {
  const { locale } = useLocale();
  return (
    <DashboardPage title={t(locale, 'security.title')} subtitle={t(locale, 'security.subtitle')}>
      {({ userRole }) => <SecurityContent userRole={userRole} />}
    </DashboardPage>
  );
}

function SecurityContent({ userRole }: { userRole: 'admin' | 'viewer' }) {
  const { locale } = useLocale();
  const [data, setData] = useState<SecurityPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      if (userRole !== 'admin') {
        return;
      }
      try {
        const payload = await jsonFetch<SecurityPayload>('/api/admin/security');
        if (!active) {
          return;
        }
        setData(payload);
        setError(null);
      } catch (loadError) {
        if (!active) {
          return;
        }
        setError(loadError instanceof Error ? loadError.message : t(locale, 'security.failedLoad'));
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [locale, userRole]);

  if (userRole !== 'admin') {
    return (
      <Card>
        <CardContent className="py-4">
          <p className="text-sm text-muted-foreground">{t(locale, 'security.adminOnly')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {error ? (
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-danger">{error}</p>
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-3 md:grid-cols-3">
        <MetricCard label={t(locale, 'security.cards.totalUsers')} value={data?.users.total ?? 0} />
        <MetricCard label={t(locale, 'security.cards.adminUsers')} value={data?.users.admins ?? 0} />
        <MetricCard label={t(locale, 'security.cards.viewerUsers')} value={data?.users.viewers ?? 0} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>{t(locale, 'security.posture.title')}</CardTitle>
          <CardDescription>{t(locale, 'security.posture.description')}</CardDescription>
        </CardHeader>
        <CardContent className="overflow-auto">
          <Table>
            <thead>
              <tr>
                <Th>{t(locale, 'security.posture.control')}</Th>
                <Th>{t(locale, 'security.posture.status')}</Th>
                <Th>{t(locale, 'security.posture.details')}</Th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <Td>{t(locale, 'security.controls.passwordHashing')}</Td>
                <Td>
                  <Badge variant="success">{t(locale, 'security.status.enabled')}</Badge>
                </Td>
                <Td>{data?.auth.passwordHashing ?? 'scrypt+salt'}</Td>
              </tr>
              <tr>
                <Td>{t(locale, 'security.controls.adminBootPassword')}</Td>
                <Td>
                  <Badge variant={data?.deployment.bootAdminPasswordConfigured ? 'success' : 'danger'}>
                    {data?.deployment.bootAdminPasswordConfigured
                      ? t(locale, 'security.status.configured')
                      : t(locale, 'security.status.missing')}
                  </Badge>
                </Td>
                <Td>
                  {data?.deployment.bootAdminPasswordIsDefault
                    ? t(locale, 'security.controls.defaultPasswordDetected')
                    : t(locale, 'security.controls.nonDefaultPassword')}
                </Td>
              </tr>
              <tr>
                <Td>{t(locale, 'security.controls.bruteForce')}</Td>
                <Td>
                  <Badge variant="success">{t(locale, 'security.status.enabled')}</Badge>
                </Td>
                <Td>
                  {t(locale, 'security.controls.bruteForceValue', {
                    max: data?.auth.bruteForceProtection.maxAttempts ?? 0,
                    window: data?.auth.bruteForceProtection.windowMinutes ?? 0,
                    lock: data?.auth.bruteForceProtection.lockMinutes ?? 0,
                  })}
                </Td>
              </tr>
              <tr>
                <Td>{t(locale, 'security.controls.csrf')}</Td>
                <Td>
                  <Badge variant={data?.auth.csrfOriginProtection ? 'success' : 'danger'}>
                    {data?.auth.csrfOriginProtection
                      ? t(locale, 'security.status.enabled')
                      : t(locale, 'security.status.disabled')}
                  </Badge>
                </Td>
                <Td>{t(locale, 'security.controls.csrfDetail')}</Td>
              </tr>
              <tr>
                <Td>{t(locale, 'security.controls.prodAdminOnly')}</Td>
                <Td>
                  <Badge variant={data?.auth.productionAdminOnlyLogin ? 'success' : 'warning'}>
                    {data?.auth.productionAdminOnlyLogin
                      ? t(locale, 'security.status.enabled')
                      : t(locale, 'security.status.partial')}
                  </Badge>
                </Td>
                <Td>{t(locale, 'security.controls.prodAdminOnlyDetail')}</Td>
              </tr>
              <tr>
                <Td>{t(locale, 'security.controls.https')}</Td>
                <Td>
                  <Badge variant={data?.deployment.httpsConfigured ? 'success' : 'warning'}>
                    {data?.deployment.httpsConfigured
                      ? t(locale, 'security.status.configured')
                      : t(locale, 'security.status.notConfigured')}
                  </Badge>
                </Td>
                <Td>{data?.deployment.hostname || '-'}</Td>
              </tr>
              <tr>
                <Td>{t(locale, 'security.controls.sessionTtl')}</Td>
                <Td>
                  <Badge variant="muted">{t(locale, 'security.status.info')}</Badge>
                </Td>
                <Td>
                  {t(locale, 'security.controls.sessionTtlValue', {
                    days: data?.auth.sessionTtlDays ?? 7,
                  })}
                </Td>
              </tr>
              <tr>
                <Td>{t(locale, 'security.controls.storage')}</Td>
                <Td>
                  <Badge variant="muted">{t(locale, 'security.status.info')}</Badge>
                </Td>
                <Td>
                  {(data?.storage.engine ?? 'sqlite') + ' / ' + (data?.storage.path ?? 'data/control-plane.sqlite')}
                </Td>
              </tr>
            </tbody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        {t(locale, 'security.lastUpdated')}: {data ? formatDate(data.generatedAt, locale) : '-'}
      </p>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
