export type Role = 'admin' | 'viewer';

export interface AuthUser {
  id: number;
  username: string;
  role: Role;
}

export interface AppItem {
  id: number;
  slug: string;
  name: string;
  createdAt?: string;
}

export interface ChannelItem {
  id: number;
  appId?: number;
  name: string;
}

export interface PolicyItem {
  id: number;
  channelId: number;
  channelName: string;
  runtimeVersion: string;
  activeReleaseId: number | null;
  rolloutPercentage: number;
  allowlistJson: string;
  blocklistJson: string;
  rollbackToEmbedded: boolean;
}

export interface ReleaseItem {
  id: number;
  appId?: number;
  runtimeVersion: string;
  bundleId: string;
  updatePath?: string;
  isRollback: boolean;
  createdAt: string;
}

export interface ApiKeyItem {
  id: number;
  name: string;
  keyPrefix: string;
  scopes: string[];
  createdAt: string;
  revokedAt: string | null;
}

export interface LogResponse {
  total: number;
  page: number;
  pageSize: number;
  items: Array<{
    id: number;
    timestamp: string;
    event_type: string;
    request_path: string;
    method: string;
    status: number;
    app_slug: string;
    channel_name: string | null;
    runtime_version: string | null;
    device_id: string;
    message: string | null;
  }>;
}

export interface DashboardPayload {
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