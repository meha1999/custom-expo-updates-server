import Head from 'next/head';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import styles from '../styles/Home.module.css';

type Role = 'admin' | 'viewer';

interface User {
  id: number;
  username: string;
  role: Role;
}

interface DashboardPayload {
  summary: {
    totalEvents: number;
    uniqueDevices: number;
    uniqueRuntimeVersions: number;
    manifestRequests: number;
    assetRequests: number;
    updateResponses: number;
    rollbackResponses: number;
    noUpdateResponses: number;
    errorResponses: number;
    totalBundles: number;
    ackSuccess: number;
    ackFailures: number;
  };
  platformBreakdown: {
    ios: number;
    android: number;
    unknown: number;
  };
  recentEvents: Array<{
    id: number;
    timestamp: string;
    eventType: string;
    requestPath: string;
    status: number;
    appSlug: string;
    channelName: string | null;
    platform: string | null;
    runtimeVersion: string | null;
    deviceId: string;
    message: string | null;
  }>;
  recentUpdates: Array<{
    id: number;
    appSlug: string;
    runtimeVersion: string;
    bundleId: string;
    createdAt: string;
    isRollback: boolean;
    manifestId: string | null;
  }>;
  devices: Array<{
    id: number;
    appSlug: string;
    deviceId: string;
    platform: string | null;
    runtimeVersion: string | null;
    channelName: string | null;
    appVersion: string | null;
    firstSeen: string;
    lastSeen: string;
    totalRequests: number;
  }>;
  recentAuditLogs: Array<{
    id: number;
    timestamp: string;
    actorUsername: string;
    action: string;
    appSlug: string;
    detailsJson: string;
  }>;
}

interface AppItem {
  id: number;
  slug: string;
  name: string;
}

interface ChannelItem {
  id: number;
  name: string;
}

interface PolicyItem {
  id: number;
  channelName: string;
  runtimeVersion: string;
  activeReleaseId: number | null;
  rolloutPercentage: number;
  allowlistJson: string;
  blocklistJson: string;
  rollbackToEmbedded: boolean;
}

interface ReleaseItem {
  id: number;
  runtimeVersion: string;
  bundleId: string;
  createdAt: string;
  isRollback: boolean;
}

interface LogResponse {
  total: number;
  page: number;
  pageSize: number;
  items: Array<{
    id: number;
    timestamp: string;
    event_type: string;
    request_path: string;
    status: number;
    app_slug: string;
    channel_name: string | null;
    runtime_version: string | null;
    device_id: string;
    message: string | null;
  }>;
}

interface ApiKeyItem {
  id: number;
  name: string;
  keyPrefix: string;
  scopes: string[];
  createdAt: string;
  revokedAt: string | null;
}

const LOG_PAGE_SIZE = 20;

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [loginUsername, setLoginUsername] = useState('admin');
  const [loginPassword, setLoginPassword] = useState('');

  const [appSlug, setAppSlug] = useState('default');
  const [apps, setApps] = useState<AppItem[]>([]);
  const [channels, setChannels] = useState<ChannelItem[]>([]);
  const [policies, setPolicies] = useState<PolicyItem[]>([]);
  const [releases, setReleases] = useState<ReleaseItem[]>([]);
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [logs, setLogs] = useState<LogResponse | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);

  const [runtimeVersion, setRuntimeVersion] = useState('1');
  const [bundleId, setBundleId] = useState('');
  const [releaseChannel, setReleaseChannel] = useState('production');
  const [rolloutPercentage, setRolloutPercentage] = useState(100);
  const [allowlistText, setAllowlistText] = useState('');
  const [blocklistText, setBlocklistText] = useState('');

  const [promoteSource, setPromoteSource] = useState('production');
  const [promoteTarget, setPromoteTarget] = useState('staging');
  const [rollbackChannel, setRollbackChannel] = useState('production');
  const [apiKeyName, setApiKeyName] = useState('');
  const [apiKeyScopes, setApiKeyScopes] = useState<string[]>(['telemetry:write']);
  const [lastGeneratedKey, setLastGeneratedKey] = useState<string | null>(null);
  const [newAppName, setNewAppName] = useState('');
  const [newAppSlug, setNewAppSlug] = useState('');
  const [newChannelName, setNewChannelName] = useState('');
  const [policyChannelName, setPolicyChannelName] = useState('production');
  const [policyRuntimeVersion, setPolicyRuntimeVersion] = useState('1');
  const [policyActiveReleaseId, setPolicyActiveReleaseId] = useState('');
  const [policyRollout, setPolicyRollout] = useState(100);
  const [policyAllowlistText, setPolicyAllowlistText] = useState('');
  const [policyBlocklistText, setPolicyBlocklistText] = useState('');
  const [policyRollback, setPolicyRollback] = useState(false);

  const [logSearch, setLogSearch] = useState('');
  const [logEventType, setLogEventType] = useState('');
  const [logStatus, setLogStatus] = useState('');
  const [logPage, setLogPage] = useState(1);

  useEffect(() => {
    void bootstrapAuth();
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }
    void refreshAll();
    const interval = window.setInterval(() => {
      void refreshDashboardOnly();
    }, 15000);
    return () => window.clearInterval(interval);
  }, [user, appSlug]);

  useEffect(() => {
    if (!user) {
      return;
    }
    void loadLogs();
  }, [user, appSlug, logPage, logSearch, logEventType, logStatus]);

  const csvExportUrl = useMemo(() => {
    const params = new URLSearchParams({
      app: appSlug,
      format: 'csv',
    });
    if (logSearch) params.set('search', logSearch);
    if (logEventType) params.set('eventType', logEventType);
    if (logStatus) params.set('status', logStatus);
    return `/api/admin/logs?${params.toString()}`;
  }, [appSlug, logSearch, logEventType, logStatus]);

  async function bootstrapAuth(): Promise<void> {
    try {
      const result = await fetch('/api/auth/me');
      if (result.ok) {
        const payload = (await result.json()) as { user: User };
        setUser(payload.user);
      }
    } finally {
      setAuthLoading(false);
    }
  }

  async function refreshDashboardOnly(): Promise<void> {
    const dash = await jsonFetch<DashboardPayload>(`/api/dashboard?app=${encodeURIComponent(appSlug)}&limit=120`);
    setDashboard(dash);
  }

  async function refreshAll(): Promise<void> {
    setError(null);
    try {
      const [dash, appsResp, channelsResp, releasesResp] = await Promise.all([
        jsonFetch<DashboardPayload>(`/api/dashboard?app=${encodeURIComponent(appSlug)}&limit=120`),
        jsonFetch<{ items: AppItem[] }>('/api/admin/apps'),
        jsonFetch<{ channels: ChannelItem[]; policies: PolicyItem[] }>(
          `/api/admin/channels?app=${encodeURIComponent(appSlug)}`,
        ),
        jsonFetch<{ items: ReleaseItem[] }>(`/api/admin/releases?app=${encodeURIComponent(appSlug)}`),
      ]);
      setDashboard(dash);
      setApps(appsResp.items);
      setChannels(channelsResp.channels);
      setPolicies(channelsResp.policies);
      setReleases(releasesResp.items);
      if (user?.role === 'admin') {
        const keyResp = await jsonFetch<{ items: ApiKeyItem[] }>('/api/admin/api-keys');
        setApiKeys(keyResp.items);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load data');
    }
  }

  async function loadLogs(): Promise<void> {
    try {
      const params = new URLSearchParams({
        app: appSlug,
        page: String(logPage),
        pageSize: String(LOG_PAGE_SIZE),
      });
      if (logSearch) params.set('search', logSearch);
      if (logEventType) params.set('eventType', logEventType);
      if (logStatus) params.set('status', logStatus);
      const response = await jsonFetch<LogResponse>(`/api/admin/logs?${params.toString()}`);
      setLogs(response);
    } catch (logError) {
      setError(logError instanceof Error ? logError.message : 'Failed to load logs');
    }
  }

  async function handleLogin(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    try {
      await jsonFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          username: loginUsername,
          password: loginPassword,
        }),
      });
      const me = await jsonFetch<{ user: User }>('/api/auth/me');
      setUser(me.user);
      setLoginPassword('');
      setBanner('Logged in successfully');
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Login failed');
    }
  }

  async function handleLogout(): Promise<void> {
    await jsonFetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    setDashboard(null);
    setLogs(null);
  }

  async function handleRegisterRelease(event: FormEvent): Promise<void> {
    event.preventDefault();
    const allowlist = parseListInput(allowlistText);
    const blocklist = parseListInput(blocklistText);
    const payload = await jsonFetch('/api/admin/releases', {
      method: 'POST',
      body: JSON.stringify({
        appSlug,
        runtimeVersion,
        bundleId,
        channelName: releaseChannel,
        rolloutPercentage,
        allowlist,
        blocklist,
      }),
    });
    setBanner(`Release registered: ${JSON.stringify(payload)}`);
    setBundleId('');
    await refreshAll();
  }

  async function handlePromote(event: FormEvent): Promise<void> {
    event.preventDefault();
    await jsonFetch('/api/admin/promote', {
      method: 'POST',
      body: JSON.stringify({
        appSlug,
        sourceChannelName: promoteSource,
        targetChannelName: promoteTarget,
        runtimeVersion,
      }),
    });
    setBanner('Promotion completed');
    await refreshAll();
  }

  async function handleRollback(event: FormEvent): Promise<void> {
    event.preventDefault();
    await jsonFetch('/api/admin/rollback', {
      method: 'POST',
      body: JSON.stringify({
        appSlug,
        channelName: rollbackChannel,
        runtimeVersion,
      }),
    });
    setBanner('Rollback policy activated');
    await refreshAll();
  }

  async function handleCreateApiKey(event: FormEvent): Promise<void> {
    event.preventDefault();
    const created = await jsonFetch<{ apiKey: string }>('/api/admin/api-keys', {
      method: 'POST',
      body: JSON.stringify({
        name: apiKeyName,
        scopes: apiKeyScopes,
      }),
    });
    setLastGeneratedKey(created.apiKey);
    setApiKeyName('');
    await refreshAll();
  }

  async function handleRevokeApiKey(id: number): Promise<void> {
    await jsonFetch('/api/admin/api-keys', {
      method: 'DELETE',
      body: JSON.stringify({ id }),
    });
    await refreshAll();
  }

  async function handleCreateApp(event: FormEvent): Promise<void> {
    event.preventDefault();
    await jsonFetch('/api/admin/apps', {
      method: 'POST',
      body: JSON.stringify({
        name: newAppName,
        slug: newAppSlug,
      }),
    });
    setNewAppName('');
    setNewAppSlug('');
    await refreshAll();
  }

  async function handleCreateChannel(event: FormEvent): Promise<void> {
    event.preventDefault();
    await jsonFetch('/api/admin/channels', {
      method: 'POST',
      body: JSON.stringify({
        appSlug,
        channelName: newChannelName,
      }),
    });
    setNewChannelName('');
    await refreshAll();
  }

  async function handleUpdatePolicy(event: FormEvent): Promise<void> {
    event.preventDefault();
    await jsonFetch('/api/admin/channels', {
      method: 'PUT',
      body: JSON.stringify({
        appSlug,
        channelName: policyChannelName,
        runtimeVersion: policyRuntimeVersion,
        activeReleaseId: policyActiveReleaseId.trim() ? Number(policyActiveReleaseId) : null,
        rolloutPercentage: policyRollout,
        allowlist: parseListInput(policyAllowlistText),
        blocklist: parseListInput(policyBlocklistText),
        rollbackToEmbedded: policyRollback,
      }),
    });
    setBanner('Runtime policy updated');
    await refreshAll();
  }

  if (authLoading) {
    return <div className={styles.container}>Loading...</div>;
  }

  if (!user) {
    return (
      <div className={styles.container}>
        <Head>
          <title>Expo Control Plane Login</title>
        </Head>
        <main className={styles.main}>
          <section className={styles.panel}>
            <h1 className={styles.title}>Control Plane Login</h1>
            <form onSubmit={handleLogin} className={styles.formGrid}>
              <input value={loginUsername} onChange={(e) => setLoginUsername(e.target.value)} placeholder="username" />
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="password"
              />
              <button type="submit">Login</button>
            </form>
            {error ? <p className={styles.error}>{error}</p> : null}
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Head>
        <title>Expo Update Control Plane</title>
      </Head>
      <main className={styles.main}>
        <section className={styles.hero}>
          <h1 className={styles.title}>Expo Update Control Plane</h1>
          <div className={styles.refreshRow}>
            <span>User: {user.username} ({user.role})</span>
            <span>App:</span>
            <select value={appSlug} onChange={(e) => setAppSlug(e.target.value)}>
              {apps.map((app) => (
                <option key={app.id} value={app.slug}>{app.slug}</option>
              ))}
            </select>
            <span>Channels: {channels.length}</span>
            <button onClick={() => void refreshAll()}>Refresh</button>
            <button onClick={() => void handleLogout()}>Logout</button>
          </div>
          {banner ? <p className={styles.notice}>{banner}</p> : null}
          {error ? <p className={styles.error}>{error}</p> : null}
        </section>

        <section className={styles.statsGrid}>
          <Metric title="Events" value={dashboard?.summary.totalEvents ?? 0} />
          <Metric title="Devices" value={dashboard?.summary.uniqueDevices ?? 0} />
          <Metric title="Updates Served" value={dashboard?.summary.updateResponses ?? 0} />
          <Metric title="Rollbacks" value={dashboard?.summary.rollbackResponses ?? 0} />
          <Metric title="ACK Success" value={dashboard?.summary.ackSuccess ?? 0} />
          <Metric title="ACK Failed" value={dashboard?.summary.ackFailures ?? 0} />
        </section>

        {user.role === 'admin' ? (
          <section className={styles.splitPanels}>
            <article className={styles.panel}>
              <h2>Release Operations</h2>
              <form onSubmit={(e) => void handleCreateApp(e)} className={styles.formGrid}>
                <input value={newAppName} onChange={(e) => setNewAppName(e.target.value)} placeholder="new app name" />
                <input value={newAppSlug} onChange={(e) => setNewAppSlug(e.target.value)} placeholder="new app slug (optional)" />
                <button type="submit">Create App</button>
              </form>
              <form onSubmit={(e) => void handleCreateChannel(e)} className={styles.formGrid}>
                <input value={newChannelName} onChange={(e) => setNewChannelName(e.target.value)} placeholder="new channel for selected app" />
                <button type="submit">Create Channel</button>
              </form>
              <form onSubmit={(e) => void handleRegisterRelease(e)} className={styles.formGrid}>
                <input value={runtimeVersion} onChange={(e) => setRuntimeVersion(e.target.value)} placeholder="runtime version" />
                <input value={bundleId} onChange={(e) => setBundleId(e.target.value)} placeholder="bundle id (folder name)" />
                <input value={releaseChannel} onChange={(e) => setReleaseChannel(e.target.value)} placeholder="channel" />
                <input type="number" min={0} max={100} value={rolloutPercentage} onChange={(e) => setRolloutPercentage(Number(e.target.value))} placeholder="rollout %" />
                <textarea value={allowlistText} onChange={(e) => setAllowlistText(e.target.value)} placeholder="allowlist device ids (comma/newline)" />
                <textarea value={blocklistText} onChange={(e) => setBlocklistText(e.target.value)} placeholder="blocklist device ids (comma/newline)" />
                <button type="submit">Publish/Register Release</button>
              </form>
              <form onSubmit={(e) => void handleUpdatePolicy(e)} className={styles.formGrid}>
                <input value={policyChannelName} onChange={(e) => setPolicyChannelName(e.target.value)} placeholder="policy channel" />
                <input value={policyRuntimeVersion} onChange={(e) => setPolicyRuntimeVersion(e.target.value)} placeholder="policy runtime version" />
                <input value={policyActiveReleaseId} onChange={(e) => setPolicyActiveReleaseId(e.target.value)} placeholder="active release id (empty = clear)" />
                <input type="number" min={0} max={100} value={policyRollout} onChange={(e) => setPolicyRollout(Number(e.target.value))} placeholder="policy rollout %" />
                <textarea value={policyAllowlistText} onChange={(e) => setPolicyAllowlistText(e.target.value)} placeholder="policy allowlist (comma/newline)" />
                <textarea value={policyBlocklistText} onChange={(e) => setPolicyBlocklistText(e.target.value)} placeholder="policy blocklist (comma/newline)" />
                <label><input type="checkbox" checked={policyRollback} onChange={(e) => setPolicyRollback(e.target.checked)} /> rollback to embedded</label>
                <button type="submit">Update Runtime Policy</button>
              </form>
              <form onSubmit={(e) => void handlePromote(e)} className={styles.formGrid}>
                <input value={promoteSource} onChange={(e) => setPromoteSource(e.target.value)} placeholder="source channel" />
                <input value={promoteTarget} onChange={(e) => setPromoteTarget(e.target.value)} placeholder="target channel" />
                <button type="submit">Promote</button>
              </form>
              <form onSubmit={(e) => void handleRollback(e)} className={styles.formGrid}>
                <input value={rollbackChannel} onChange={(e) => setRollbackChannel(e.target.value)} placeholder="rollback channel" />
                <button type="submit">Rollback to Embedded</button>
              </form>
            </article>

            <article className={styles.panel}>
              <h2>API Keys</h2>
              <form onSubmit={(e) => void handleCreateApiKey(e)} className={styles.formGrid}>
                <input value={apiKeyName} onChange={(e) => setApiKeyName(e.target.value)} placeholder="key name" />
                <div className={styles.refreshRow}>
                  <label><input type="checkbox" checked={apiKeyScopes.includes('telemetry:write')} onChange={() => setApiKeyScopes(toggleScope(apiKeyScopes, 'telemetry:write'))} /> telemetry:write</label>
                  <label><input type="checkbox" checked={apiKeyScopes.includes('logs:write')} onChange={() => setApiKeyScopes(toggleScope(apiKeyScopes, 'logs:write'))} /> logs:write</label>
                  <label><input type="checkbox" checked={apiKeyScopes.includes('admin')} onChange={() => setApiKeyScopes(toggleScope(apiKeyScopes, 'admin'))} /> admin</label>
                </div>
                <button type="submit">Create API Key</button>
              </form>
              {lastGeneratedKey ? <p className={styles.notice}>New key: <code>{lastGeneratedKey}</code></p> : null}
              <div className={styles.tableScroll}>
                <table className={styles.table}>
                  <thead><tr><th>Name</th><th>Prefix</th><th>Scopes</th><th>Action</th></tr></thead>
                  <tbody>
                    {apiKeys.map((key) => (
                      <tr key={key.id}>
                        <td>{key.name}</td>
                        <td>{key.keyPrefix}</td>
                        <td>{key.scopes.join(', ')}</td>
                        <td>{key.revokedAt ? 'Revoked' : <button onClick={() => void handleRevokeApiKey(key.id)}>Revoke</button>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          </section>
        ) : null}

        <section className={styles.panel}>
          <h2>Logs</h2>
          <div className={styles.refreshRow}>
            <input value={logSearch} onChange={(e) => { setLogPage(1); setLogSearch(e.target.value); }} placeholder="search" />
            <input value={logEventType} onChange={(e) => { setLogPage(1); setLogEventType(e.target.value); }} placeholder="event type" />
            <input value={logStatus} onChange={(e) => { setLogPage(1); setLogStatus(e.target.value); }} placeholder="status" />
            <a href={csvExportUrl}>Export CSV</a>
          </div>
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead><tr><th>Time</th><th>Event</th><th>Status</th><th>Channel</th><th>Runtime</th><th>Device</th></tr></thead>
              <tbody>
                {logs?.items.map((item) => (
                  <tr key={item.id}>
                    <td>{formatDate(item.timestamp)}</td>
                    <td>{item.event_type}</td>
                    <td>{item.status}</td>
                    <td>{item.channel_name ?? '-'}</td>
                    <td>{item.runtime_version ?? '-'}</td>
                    <td>{item.device_id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.refreshRow}>
            <button disabled={(logs?.page ?? 1) <= 1} onClick={() => setLogPage((v) => Math.max(1, v - 1))}>Prev</button>
            <span>Page {logs?.page ?? 1}</span>
            <button
              disabled={(logs?.page ?? 1) * LOG_PAGE_SIZE >= (logs?.total ?? 0)}
              onClick={() => setLogPage((v) => v + 1)}>
              Next
            </button>
          </div>
        </section>

        <section className={styles.splitPanels}>
          <article className={styles.panel}>
            <h2>Devices</h2>
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <thead><tr><th>Device</th><th>Platform</th><th>Runtime</th><th>App Ver</th><th>Channel</th><th>Last Seen</th></tr></thead>
                <tbody>
                  {dashboard?.devices.slice(0, 25).map((device) => (
                    <tr key={device.id}>
                      <td>{device.deviceId}</td>
                      <td>{device.platform ?? '-'}</td>
                      <td>{device.runtimeVersion ?? '-'}</td>
                      <td>{device.appVersion ?? '-'}</td>
                      <td>{device.channelName ?? '-'}</td>
                      <td>{formatDate(device.lastSeen)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
          <article className={styles.panel}>
            <h2>Runtime Policies</h2>
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <thead><tr><th>Channel</th><th>Runtime</th><th>Release</th><th>Rollout</th><th>Rollback</th></tr></thead>
                <tbody>
                  {policies.map((policy) => (
                    <tr key={policy.id}>
                      <td>{policy.channelName}</td>
                      <td>{policy.runtimeVersion}</td>
                      <td>{policy.activeReleaseId ?? '-'}</td>
                      <td>{policy.rolloutPercentage}%</td>
                      <td>{policy.rollbackToEmbedded ? 'Yes' : 'No'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
          <article className={styles.panel}>
            <h2>Releases</h2>
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <thead><tr><th>ID</th><th>Runtime</th><th>Bundle</th><th>Type</th><th>Created</th></tr></thead>
                <tbody>
                  {releases.slice(0, 25).map((release) => (
                    <tr key={release.id}>
                      <td>{release.id}</td>
                      <td>{release.runtimeVersion}</td>
                      <td>{release.bundleId}</td>
                      <td>{release.isRollback ? 'rollback' : 'update'}</td>
                      <td>{formatDate(release.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
          <article className={styles.panel}>
            <h2>Audit Trail</h2>
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Details</th></tr></thead>
                <tbody>
                  {dashboard?.recentAuditLogs.slice(0, 25).map((entry) => (
                    <tr key={entry.id}>
                      <td>{formatDate(entry.timestamp)}</td>
                      <td>{entry.actorUsername}</td>
                      <td>{entry.action}</td>
                      <td>{entry.detailsJson}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </section>
      </main>
    </div>
  );
}

function Metric({ title, value }: { title: string; value: number }) {
  return (
    <article className={styles.metric}>
      <h2>{title}</h2>
      <p>{value}</p>
    </article>
  );
}

async function jsonFetch<T = any>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.error ?? `Request failed: ${response.status}`);
  }
  return (await response.json()) as T;
}

function parseListInput(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[\n,]/g)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function toggleScope(scopes: string[], scope: string): string[] {
  if (scopes.includes(scope)) {
    return scopes.filter((item) => item !== scope);
  }
  return [...scopes, scope];
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}
