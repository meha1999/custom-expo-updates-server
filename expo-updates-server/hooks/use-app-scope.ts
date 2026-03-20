import { useRouter } from 'next/router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  const mountedRef = useRef(true);

  const queryApp = readQueryApp(router.query.app);
  const selectedApp = useMemo(() => {
    if (queryApp) {
      return queryApp;
    }
    return apps[0]?.slug ?? 'default';
  }, [queryApp, apps]);

  const loadApps = useCallback(
    async (syncQuery: boolean) => {
      const payload = await jsonFetch<{ items: AppItem[] }>('/api/admin/apps');
      if (!mountedRef.current) {
        return;
      }
      setApps(payload.items);

      if (syncQuery && !readQueryApp(router.query.app) && payload.items[0]?.slug) {
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
    },
    [router],
  );

  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    [],
  );

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    let active = true;

    async function loadInitialApps() {
      try {
        await loadApps(true);
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadInitialApps();
    return () => {
      active = false;
    };
  }, [enabled, loadApps]);

  async function refreshApps(): Promise<void> {
    if (!enabled) {
      return;
    }
    await loadApps(false);
  }

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
    refreshApps,
  };
}
