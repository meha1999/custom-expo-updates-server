import Head from 'next/head';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useLocale } from '../hooks/use-locale';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { FieldLabel } from '../components/ui/field-label';
import { Input } from '../components/ui/input';
import { t } from '../lib/i18n';
import type { Locale } from '../lib/i18n';
import { jsonFetch } from '../lib/http';
import { Select } from '../components/ui/select';

export default function LoginPage() {
  const router = useRouter();
  const { locale, setLocale } = useLocale();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hints =
    locale === 'fa'
      ? {
          language: 'زبان رابط کاربری داشبورد را تغییر می‌دهد.',
          username: 'نام کاربری حسابی که دسترسی به داشبورد دارد.',
          password: 'رمز عبور همان حساب کاربری برای ورود امن.',
        }
      : {
          language: 'Changes the dashboard interface language.',
          username: 'Username of the account that can access the dashboard.',
          password: 'Password for that account used for secure sign in.',
        };

  useEffect(() => {
    let active = true;

    async function checkSession() {
      try {
        const response = await fetch('/api/auth/me');
        if (!active) return;
        if (response.ok) {
          await router.replace('/dashboard');
          return;
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void checkSession();
    return () => {
      active = false;
    };
  }, [router]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await jsonFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      await router.push('/dashboard');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t(locale, 'login.loginFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        {t(locale, 'login.sessionLoading')}
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{t(locale, 'login.pageTitle')}</title>
      </Head>
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Expo</p>
              <div className="w-28">
                <div className="space-y-1">
                  <FieldLabel
                    label={t(locale, 'shell.language')}
                    hint={hints.language}
                    className="justify-end"
                  />
                  <Select value={locale} onChange={(event) => setLocale(event.target.value as Locale)}>
                    <option value="en">{t(locale, 'shell.english')}</option>
                    <option value="fa">{t(locale, 'shell.persian')}</option>
                  </Select>
                </div>
              </div>
            </div>
            <CardTitle className="text-xl">{t(locale, 'login.heading')}</CardTitle>
            <CardDescription>{t(locale, 'login.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={handleSubmit}>
              <div className="space-y-1">
                <FieldLabel label={t(locale, 'login.username')} hint={hints.username} />
                <Input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder={t(locale, 'login.username')}
                  autoComplete="username"
                  required
                />
              </div>
              <div className="space-y-1">
                <FieldLabel label={t(locale, 'login.password')} hint={hints.password} />
                <Input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={t(locale, 'login.password')}
                  autoComplete="current-password"
                  required
                />
              </div>
              {error ? <p className="text-sm text-danger">{error}</p> : null}
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? t(locale, 'login.signingIn') : t(locale, 'login.signIn')}
              </Button>
            </form>
            <div className="mt-4 rounded-md border border-warning/30 bg-warning/10 p-3 text-xs">
              <p>
                {t(locale, 'login.defaultLogin')}{' '}
                <span className="font-semibold">admin / change-me-now</span>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
