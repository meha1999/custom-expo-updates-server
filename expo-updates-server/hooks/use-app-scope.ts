import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import { jsonFetch } from '../lib/http';
import { AppItem } from '../lib/types';

function readQueryApp(value: string | string[] | undefined): string | null {
  if (typeof value === 'string' && value.trim()) {
    return value;
  }
  if (Array.isArray(value) && value[0]) {
    return value[0];
  }
  return null;
}

export function useAppScope(enabled: boolean) {
  const router = useRouter();
  const [apps, setApps] = useState<AppItem[]>([]);
  const [loading, setLoading] = useState(true);

  const queryApp = readQueryApp(router.query.app);
  const selectedApp = useMemo(() => {
    if (queryApp) {
      return queryApp;
    }
    return apps[0]?.slug ?? 'default';
  }, [queryApp, apps]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    let active = true;

    async function loadApps() {
      try {
        const payload = await jsonFetch<{ items: AppItem[] }>('/api/admin/apps');
        if (!active) return;
        setApps(payload.items);

        if (!readQueryApp(router.query.app) && payload.items[0]?.slug) {
          await router.replace(
            {
              pathname: router.pathname,
              query: {
                ...router.query,
                app: payload.items[0].slug,
              },
            },
            undefined,
            { shallow: true },
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadApps();
    return () => {
      active = false;
    };
  }, [enabled, router]);

  async function setApp(slug: string): Promise<void> {
    await router.push(
      {
        pathname: router.pathname,
        query: {
          ...router.query,
          app: slug,
        },
      },
      undefined,
      { shallow: true },
    );
  }

  return {
    apps,
    appSlug: selectedApp,
    loading,
    setApp,
  };
}