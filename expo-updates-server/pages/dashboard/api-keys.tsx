import { FormEvent, useEffect, useState } from 'react';
import { DashboardPage } from '../../components/layout/dashboard-page';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { FieldLabel } from '../../components/ui/field-label';
import { Input } from '../../components/ui/input';
import { Modal } from '../../components/ui/modal';
import { Table, Td, Th } from '../../components/ui/table';
import { useToast } from '../../components/providers/toast-provider';
import { useLocale } from '../../hooks/use-locale';
import { formatDate } from '../../lib/format';
import { jsonFetch } from '../../lib/http';
import { t } from '../../lib/i18n';
import { ApiKeyItem } from '../../lib/types';

const AVAILABLE_SCOPES = ['telemetry:write', 'logs:write', 'admin'];

export default function ApiKeysPage() {
  const { locale } = useLocale();
  return (
    <DashboardPage
      title={t(locale, 'apiKeys.title')}
      subtitle={t(locale, 'apiKeys.subtitle')}
    >
      {({ userRole }) => <ApiKeysContent userRole={userRole} />}
    </DashboardPage>
  );
}

function ApiKeysContent({ userRole }: { userRole: 'admin' | 'viewer' }) {
  const { locale } = useLocale();
  const toast = useToast();
  const [items, setItems] = useState<ApiKeyItem[]>([]);
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<string[]>(['telemetry:write']);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creatingKey, setCreatingKey] = useState(false);
  const [revokingKeyId, setRevokingKeyId] = useState<number | null>(null);
  const [showCreateKeyModal, setShowCreateKeyModal] = useState(false);
  const hints =
    locale === 'fa'
      ? {
          keyName: 'نام قابل شناسایی برای این کلید تا بعدا راحت‌تر مدیریت شود.',
          scopes: 'دامنه دسترسی کلید. فقط مجوزهای لازم را انتخاب کنید.',
        }
      : {
          keyName: 'A recognizable name so this key is easier to manage later.',
          scopes: 'Permission scope for this key. Select only what is required.',
        };

  useEffect(() => {
    if (userRole !== 'admin') return;
    void load();
  }, [userRole, locale]);

  async function load(): Promise<void> {
    try {
      const payload = await jsonFetch<{ items: ApiKeyItem[] }>('/api/admin/api-keys');
      setItems(payload.items);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t(locale, 'apiKeys.failedLoad'));
    }
  }

  async function createKey(event: FormEvent): Promise<void> {
    event.preventDefault();
    try {
      setCreatingKey(true);
      const payload = await jsonFetch<{ apiKey: string }>('/api/admin/api-keys', {
        method: 'POST',
        body: JSON.stringify({
          name,
          scopes,
        }),
      });
      setCreatedKey(payload.apiKey);
      setName('');
      setShowCreateKeyModal(false);
      await load();
      toast.success(locale === 'fa' ? 'کلید API ایجاد شد.' : 'API key created.');
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : t(locale, 'apiKeys.failedLoad');
      setError(message);
      toast.error(message);
    } finally {
      setCreatingKey(false);
    }
  }

  async function revokeKey(id: number): Promise<void> {
    const confirmed =
      typeof window === 'undefined'
        ? true
        : window.confirm(
            locale === 'fa'
              ? 'آیا از لغو این کلید API مطمئن هستید؟'
              : 'Are you sure you want to revoke this API key?',
          );
    if (!confirmed) {
      return;
    }
    try {
      setRevokingKeyId(id);
      await jsonFetch('/api/admin/api-keys', {
        method: 'DELETE',
        body: JSON.stringify({ id }),
      });
      await load();
      toast.success(locale === 'fa' ? 'کلید API لغو شد.' : 'API key revoked.');
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : t(locale, 'apiKeys.failedLoad');
      setError(message);
      toast.error(message);
    } finally {
      setRevokingKeyId(null);
    }
  }

  function toggleScope(scope: string) {
    setScopes((current) => {
      if (current.includes(scope)) {
        return current.filter((item) => item !== scope);
      }
      return [...current, scope];
    });
  }

  if (userRole !== 'admin') {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          {t(locale, 'apiKeys.viewerOnly')}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <Card>
        <CardHeader>
          <CardTitle>{t(locale, 'apiKeys.create.title')}</CardTitle>
          <CardDescription>{t(locale, 'apiKeys.create.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-muted/30 p-3">
            <p className="text-sm text-muted-foreground">
              {locale === 'fa'
                ? 'فرم ایجاد کلید API در پنجره جداگانه باز می‌شود.'
                : 'Open the API key form in a modal and keep this page focused on key inventory.'}
            </p>
            <Button type="button" onClick={() => setShowCreateKeyModal(true)}>
              {t(locale, 'apiKeys.create.button')}
            </Button>
          </div>
          {createdKey ? (
            <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-xs">
              <p className="font-medium">{t(locale, 'apiKeys.create.copyNow')}</p>
              <p className="mt-1 break-all">{createdKey}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>
      <Modal
        open={showCreateKeyModal}
        onClose={() => setShowCreateKeyModal(false)}
        title={t(locale, 'apiKeys.create.title')}
        description={t(locale, 'apiKeys.create.description')}
        widthClassName="max-w-3xl"
      >
        <form className="grid gap-3 md:grid-cols-3" onSubmit={(event) => void createKey(event)}>
          <div className="space-y-1">
            <FieldLabel label={t(locale, 'apiKeys.create.keyName')} hint={hints.keyName} />
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t(locale, 'apiKeys.create.keyName')}
              required
            />
          </div>
          <div className="md:col-span-2 flex flex-wrap items-start gap-3 rounded-md border border-border p-3">
            <FieldLabel label={locale === 'fa' ? 'دسترسی‌ها' : 'Scopes'} hint={hints.scopes} className="w-full" />
            {AVAILABLE_SCOPES.map((scope) => (
              <label key={scope} className="inline-flex items-center gap-1 text-xs">
                <input type="checkbox" checked={scopes.includes(scope)} onChange={() => toggleScope(scope)} />
                {scope}
              </label>
            ))}
          </div>
          <div className="md:col-span-3">
            <Button
              type="submit"
              loading={creatingKey}
              loadingText={locale === 'fa' ? 'در حال ایجاد...' : 'Creating...'}
            >
              {t(locale, 'apiKeys.create.button')}
            </Button>
          </div>
        </form>
      </Modal>

      <Card>
        <CardHeader>
          <CardTitle>{t(locale, 'apiKeys.list.title')}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-auto">
          <Table>
            <thead>
              <tr>
                <Th>{t(locale, 'apiKeys.list.name')}</Th>
                <Th>{t(locale, 'apiKeys.list.prefix')}</Th>
                <Th>{t(locale, 'apiKeys.list.scopes')}</Th>
                <Th>{locale === 'fa' ? 'ایجاد شده' : 'Created'}</Th>
                <Th>{t(locale, 'apiKeys.list.status')}</Th>
                <Th>{t(locale, 'apiKeys.list.action')}</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <Td>
                    <div className="space-y-1">
                      <p>{item.name}</p>
                      <p className="text-xs text-muted-foreground">ID: {item.id}</p>
                    </div>
                  </Td>
                  <Td>
                    <span className="font-mono text-xs">{item.keyPrefix}</span>
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {item.scopes.map((scope) => (
                        <Badge key={`${item.id}-${scope}`} variant="muted">
                          {scope}
                        </Badge>
                      ))}
                    </div>
                  </Td>
                  <Td>{formatDate(item.createdAt, locale)}</Td>
                  <Td>
                    {item.revokedAt ? (
                      <div className="space-y-1">
                        <Badge variant="danger">{t(locale, 'apiKeys.list.revoked')}</Badge>
                        <p className="text-xs text-muted-foreground">{formatDate(item.revokedAt, locale)}</p>
                      </div>
                    ) : (
                      <Badge variant="success">{t(locale, 'apiKeys.list.active')}</Badge>
                    )}
                  </Td>
                  <Td>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={Boolean(item.revokedAt)}
                      loading={revokingKeyId === item.id}
                      loadingText={locale === 'fa' ? 'در حال لغو...' : 'Revoking...'}
                      onClick={() => void revokeKey(item.id)}
                    >
                      {t(locale, 'apiKeys.list.revoke')}
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
