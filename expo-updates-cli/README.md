# custom-expo-update CLI

A small Linux-friendly CLI for publishing Expo OTA updates to this custom updates server.

## Install

From this repository root:

```bash
npm install -g ./expo-updates-cli
```

## One-time login (like EAS)

```bash
custom-expo-update login \
  --server http://localhost:3000 \
  --username admin \
  --password '<your-admin-password>'
```

This saves server + session locally at:

`~/.config/custom-expo-update/config.json`

## Publish automatically (recommended)

From your Expo app directory (`expo-updates-client`):

```bash
custom-expo-update publish:auto
```

`publish:auto` will:

- run `expo export --output-dir dist`
- read `runtimeVersion` from your `app.json`
- auto-generate `bundle-id` using current unix timestamp
- upload `./dist` to your saved server with your saved login

Optional overrides:

```bash
custom-expo-update publish:auto \
  --project-dir ./expo-updates-client \
  --channel production \
  --bundle-id "$(date +%s)" \
  --runtime-version 2 \
  --dir dist
```

## Manual publish

- `--runtime-version` runtime version
- `--bundle-id` bundle/update id directory name
- `--dir` directory created by `expo export`
- `--channel` optional channel name to assign
- `--rollout-percentage` optional 0-100
- `--allowlist` optional CSV of device IDs
- `--blocklist` optional CSV of device IDs

Example:

```bash
custom-expo-update publish \
  --runtime-version 2 \
  --bundle-id "$(date +%s)" \
  --dir ./dist \
  --channel production
```

## Session commands

- `custom-expo-update whoami`
- `custom-expo-update logout`

## Environment variable fallback

You can use these instead of CLI flags:

- `EXPO_UPDATES_SERVER_URL`
- `EXPO_UPDATES_USERNAME`
- `EXPO_UPDATES_PASSWORD`
- `EXPO_UPDATES_RUNTIME_VERSION`
- `EXPO_UPDATES_BUNDLE_ID`
- `EXPO_UPDATES_EXPORT_DIR`
- `EXPO_UPDATES_CHANNEL`
