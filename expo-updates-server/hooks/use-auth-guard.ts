import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { jsonFetch } from '../lib/http';
import { AuthUser } from '../lib/types';

export function useAuthGuard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const payload = await jsonFetch<{ user: AuthUser }>('/api/auth/me');
        if (!active) return;
        setUser(payload.user);
      } catch {
        if (!active) return;
        await router.replace('/');
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [router]);

  async function logout(): Promise<void> {
    try {
      await jsonFetch('/api/auth/logout', { method: 'POST' });
    } catch (logoutError) {
      setError(logoutError instanceof Error ? logoutError.message : 'Logout failed');
    } finally {
      await router.push('/');
    }
  }

  return {
    user,
    loading,
    error,
    logout,
  };
}