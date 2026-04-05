#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

const CONFIG_DIR = path.join(os.homedir(), '.config', 'custom-expo-update');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const DEFAULT_EXPORT_DIR = 'dist';

function printUsage() {
  console.log(`custom-expo-update

Usage:
  custom-expo-update login --server <url> --username <user> --password <pass>
  custom-expo-update whoami
  custom-expo-update logout
  custom-expo-update publish --runtime-version <value> --bundle-id <value> --dir <export-dir> [--channel <name>] [--rollout-percentage <0-100>] [--allowlist <id1,id2>] [--blocklist <id3,id4>]
  custom-expo-update publish:auto [--project-dir <expo-project>] [--channel <name>] [--bundle-id <value>] [--runtime-version <value>] [--dir <export-dir>] [--rollout-percentage <0-100>] [--allowlist <id1,id2>] [--blocklist <id3,id4>]

Environment fallback:
  EXPO_UPDATES_SERVER_URL
  EXPO_UPDATES_USERNAME
  EXPO_UPDATES_PASSWORD
  EXPO_UPDATES_RUNTIME_VERSION
  EXPO_UPDATES_BUNDLE_ID
  EXPO_UPDATES_EXPORT_DIR
  EXPO_UPDATES_CHANNEL
`);
}

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function readConfig() {
  if (!fs.existsSync(CONFIG_FILE)) {
    return {};
  }
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch {
    fail(`Invalid config file: ${CONFIG_FILE}`);
  }
}

function writeConfig(nextConfig) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(nextConfig, null, 2), 'utf8');
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      args._.push(token);
      continue;
    }
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    i += 1;
  }
  return args;
}

function toAbsolute(p) {
  return path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
}

function normalizeRelative(filePath) {
  return filePath.split(path.sep).join('/');
}

function walkFiles(rootDir) {
  const out = [];
  const stack = [''];
  while (stack.length > 0) {
    const relativeDir = stack.pop();
    const absoluteDir = path.join(rootDir, relativeDir);
    const entries = fs.readdirSync(absoluteDir, { withFileTypes: true });
    for (const entry of entries) {
      const relativePath = path.join(relativeDir, entry.name);
      if (entry.isDirectory()) {
        stack.push(relativePath);
      } else if (entry.isFile()) {
        out.push(normalizeRelative(relativePath));
      }
    }
  }
  return out;
}

function parseCsv(rawValue) {
  if (!rawValue || typeof rawValue !== 'string') {
    return [];
  }
  return rawValue
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseRollout(rawValue) {
  if (rawValue === undefined) {
    return undefined;
  }
  const value = Number(rawValue);
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    fail('--rollout-percentage must be a number between 0 and 100');
  }
  return value;
}

function requireString(value, keyName) {
  if (!value || typeof value !== 'string' || value.trim() === '') {
    fail(`Missing required value: ${keyName}`);
  }
  return value.trim();
}

function normalizeServerBase(value) {
  return requireString(value, 'server').replace(/\/+$/, '');
}

function getHeaderSetCookie(response) {
  const getSetCookie = response.headers.getSetCookie;
  if (typeof getSetCookie === 'function') {
    const cookies = getSetCookie.call(response.headers);
    if (Array.isArray(cookies) && cookies.length > 0) {
      return cookies.join('; ');
    }
  }
  const single = response.headers.get('set-cookie');
  return single || '';
}

async function performLogin({ serverBase, username, password }) {
  const response = await fetch(`${serverBase}/api/auth/login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    const body = await response.text();
    fail(`Login failed (${response.status}): ${body}`);
  }

  const cookie = getHeaderSetCookie(response);
  if (!cookie) {
    fail('Login succeeded but no session cookie was returned');
  }
  const body = await response.json();
  return {
    cookie,
    expiresAt: body?.expiresAt ?? null,
    user: body?.user ?? null,
  };
}

async function fetchCurrentUser({ serverBase, sessionCookie }) {
  const response = await fetch(`${serverBase}/api/auth/me`, {
    method: 'GET',
    headers: {
      cookie: sessionCookie,
    },
  });
  if (!response.ok) {
    return null;
  }
  const body = await response.json();
  return body?.user ?? null;
}

function resolveServer(args, config) {
  return normalizeServerBase(
    args.server || process.env.EXPO_UPDATES_SERVER_URL || config.server,
  );
}

function resolveUsername(args, config) {
  return requireString(
    args.username || process.env.EXPO_UPDATES_USERNAME || config.username,
    '--username or EXPO_UPDATES_USERNAME or saved login',
  );
}

function resolveSessionCookie(args, config) {
  return args.session || config.sessionCookie || '';
}

function readExpoConfig(projectDir) {
  const appJsonPath = path.join(projectDir, 'app.json');
  if (!fs.existsSync(appJsonPath)) {
    fail(`app.json not found in project directory: ${projectDir}`);
  }
  let appJson;
  try {
    appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
  } catch {
    fail(`Unable to parse app.json: ${appJsonPath}`);
  }
  const expo = appJson?.expo ?? {};
  const runtimeVersion = `${expo.runtimeVersion ?? ''}`.trim();
  const updatesUrl = `${expo?.updates?.url ?? ''}`.trim();
  const manifestSuffix = '/api/manifest';
  const serverBase = updatesUrl.endsWith(manifestSuffix)
    ? updatesUrl.slice(0, -manifestSuffix.length)
    : '';
  return {
    runtimeVersion,
    serverBase,
  };
}

function runExpoExport(projectDir, outDir) {
  const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const result = spawnSync(command, ['expo', 'export', '--output-dir', outDir], {
    cwd: projectDir,
    stdio: 'inherit',
    shell: false,
  });
  if (result.status !== 0) {
    fail('expo export failed');
  }
}

function getTimestampBundleId() {
  return `${Math.floor(Date.now() / 1000)}`;
}

function encodeFiles(exportDir) {
  const relativePaths = walkFiles(exportDir);
  if (relativePaths.length === 0) {
    fail(`No files found in export directory: ${exportDir}`);
  }

  return relativePaths.map((relativePath) => {
    const absolutePath = path.join(exportDir, relativePath);
    const buffer = fs.readFileSync(absolutePath);
    return {
      path: relativePath,
      contentBase64: buffer.toString('base64'),
    };
  });
}

async function uploadRelease({
  serverBase,
  sessionCookie,
  runtimeVersion,
  bundleId,
  channelName,
  rolloutPercentage,
  allowlist,
  blocklist,
  files,
}) {
  const payload = {
    runtimeVersion,
    bundleId,
    channelName,
    files,
  };
  if (rolloutPercentage !== undefined) {
    payload.rolloutPercentage = rolloutPercentage;
  }
  if (allowlist.length > 0) {
    payload.allowlist = allowlist;
  }
  if (blocklist.length > 0) {
    payload.blocklist = blocklist;
  }

  const response = await fetch(`${serverBase}/api/admin/upload-release`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: sessionCookie,
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  if (!response.ok) {
    fail(`Upload failed (${response.status}): ${text}`);
  }

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    fail('Upload succeeded but response was not valid JSON');
  }

  const releaseId = json?.release?.id ?? 'unknown';
  const fileCount = json?.upload?.fileCount ?? files.length;
  const totalBytes = json?.upload?.totalBytes ?? 0;
  const policyId = json?.policy?.id ?? null;
  console.log(`Published release ${releaseId}`);
  console.log(`Files: ${fileCount}`);
  console.log(`Bytes: ${totalBytes}`);
  if (policyId) {
    console.log(`Channel policy: ${policyId}`);
  }
}

async function runPublish(args) {
  const config = readConfig();
  const serverBase = resolveServer(args, config);
  const username = resolveUsername(args, config);
  let sessionCookie = resolveSessionCookie(args, config);

  if (!sessionCookie) {
    const password = requireString(
      args.password || process.env.EXPO_UPDATES_PASSWORD,
      '--password or EXPO_UPDATES_PASSWORD (or run: custom-expo-update login)',
    );
    const session = await performLogin({ serverBase, username, password });
    sessionCookie = session.cookie;
    writeConfig({
      ...config,
      server: serverBase,
      username,
      sessionCookie: session.cookie,
      sessionExpiresAt: session.expiresAt,
    });
  }

  const currentUser = await fetchCurrentUser({ serverBase, sessionCookie });
  if (!currentUser) {
    fail('Saved session is invalid or expired. Run: custom-expo-update login');
  }

  const runtimeVersion = requireString(
    args['runtime-version'] || process.env.EXPO_UPDATES_RUNTIME_VERSION,
    '--runtime-version or EXPO_UPDATES_RUNTIME_VERSION',
  );
  const bundleId = requireString(
    args['bundle-id'] || process.env.EXPO_UPDATES_BUNDLE_ID,
    '--bundle-id or EXPO_UPDATES_BUNDLE_ID',
  );
  const exportDirRaw = requireString(
    args.dir || process.env.EXPO_UPDATES_EXPORT_DIR,
    '--dir or EXPO_UPDATES_EXPORT_DIR',
  );
  const channelName = (args.channel || process.env.EXPO_UPDATES_CHANNEL || '').trim();
  const rolloutPercentage = parseRollout(args['rollout-percentage']);
  const allowlist = parseCsv(args.allowlist);
  const blocklist = parseCsv(args.blocklist);

  const exportDir = toAbsolute(exportDirRaw);
  if (!fs.existsSync(exportDir) || !fs.statSync(exportDir).isDirectory()) {
    fail(`Export directory does not exist: ${exportDir}`);
  }

  console.log(`Reading files from ${exportDir}`);
  const files = encodeFiles(exportDir);
  console.log(`Collected ${files.length} files`);

  console.log('Uploading release');
  await uploadRelease({
    serverBase,
    sessionCookie,
    runtimeVersion,
    bundleId,
    channelName,
    rolloutPercentage,
    allowlist,
    blocklist,
    files,
  });
}

async function runPublishAuto(args) {
  const config = readConfig();
  const projectDir = toAbsolute(args['project-dir'] || process.cwd());
  const exportDirName = (args.dir || DEFAULT_EXPORT_DIR).trim();
  const expoConfig = readExpoConfig(projectDir);

  const serverBase = normalizeServerBase(
    args.server || process.env.EXPO_UPDATES_SERVER_URL || config.server || expoConfig.serverBase,
  );
  const runtimeVersion = requireString(
    args['runtime-version'] || process.env.EXPO_UPDATES_RUNTIME_VERSION || expoConfig.runtimeVersion,
    '--runtime-version (or set runtimeVersion in app.json)',
  );
  const bundleId = `${args['bundle-id'] || process.env.EXPO_UPDATES_BUNDLE_ID || getTimestampBundleId()}`;
  const exportDir = toAbsolute(path.join(projectDir, exportDirName));
  const channelName = (args.channel || process.env.EXPO_UPDATES_CHANNEL || '').trim();
  const rolloutPercentage = parseRollout(args['rollout-percentage']);
  const allowlist = parseCsv(args.allowlist);
  const blocklist = parseCsv(args.blocklist);

  const username = resolveUsername(args, config);
  const sessionCookie = resolveSessionCookie(args, config);
  if (!sessionCookie) {
    fail('No saved login found. Run: custom-expo-update login --server <url> --username <user> --password <pass>');
  }

  const currentUser = await fetchCurrentUser({ serverBase, sessionCookie });
  if (!currentUser) {
    fail('Saved session is invalid or expired. Run: custom-expo-update login');
  }

  console.log(`Running expo export in ${projectDir}`);
  runExpoExport(projectDir, exportDirName);

  if (!fs.existsSync(exportDir) || !fs.statSync(exportDir).isDirectory()) {
    fail(`Export directory does not exist: ${exportDir}`);
  }

  console.log(`Publishing runtime=${runtimeVersion} bundle=${bundleId}`);
  const files = encodeFiles(exportDir);
  console.log(`Collected ${files.length} files`);

  await uploadRelease({
    serverBase,
    sessionCookie,
    runtimeVersion,
    bundleId,
    channelName,
    rolloutPercentage,
    allowlist,
    blocklist,
    files,
  });
}

async function runLogin(args) {
  const config = readConfig();
  const serverBase = normalizeServerBase(
    args.server || process.env.EXPO_UPDATES_SERVER_URL || config.server,
  );
  const username = resolveUsername(args, config);
  const password = requireString(
    args.password || process.env.EXPO_UPDATES_PASSWORD,
    '--password or EXPO_UPDATES_PASSWORD',
  );

  const session = await performLogin({ serverBase, username, password });
  writeConfig({
    ...config,
    server: serverBase,
    username,
    sessionCookie: session.cookie,
    sessionExpiresAt: session.expiresAt,
  });

  console.log(`Logged in as ${session?.user?.username || username}`);
  console.log(`Saved config: ${CONFIG_FILE}`);
}

async function runWhoAmI(args) {
  const config = readConfig();
  const serverBase = normalizeServerBase(
    args.server || process.env.EXPO_UPDATES_SERVER_URL || config.server,
  );
  const sessionCookie = resolveSessionCookie(args, config);
  if (!sessionCookie) {
    fail('No saved login found. Run: custom-expo-update login');
  }
  const user = await fetchCurrentUser({ serverBase, sessionCookie });
  if (!user) {
    fail('Saved session is invalid or expired. Run: custom-expo-update login');
  }
  console.log(`Server: ${serverBase}`);
  console.log(`User: ${user.username}`);
  console.log(`Role: ${user.role}`);
}

function runLogout() {
  if (fs.existsSync(CONFIG_FILE)) {
    fs.rmSync(CONFIG_FILE, { force: true });
  }
  console.log('Logged out');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0];
  if (!command || command === 'help' || args.help) {
    printUsage();
    process.exit(0);
  }
  if (command === 'publish') {
    await runPublish(args);
    return;
  }
  if (command === 'publish:auto') {
    await runPublishAuto(args);
    return;
  }
  if (command === 'login') {
    await runLogin(args);
    return;
  }
  if (command === 'whoami') {
    await runWhoAmI(args);
    return;
  }
  if (command === 'logout') {
    runLogout();
    return;
  }
  fail(`Unknown command: ${command}`);
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : 'Unexpected failure');
});
