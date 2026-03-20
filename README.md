# Custom Expo Updates Server & Client

This repo contains a server and client that implement the [Expo Updates protocol specification](https://docs.expo.dev/technical-specs/expo-updates-0).

> [!IMPORTANT]
> This repo exists to provide a basic demonstration of how the protocol might be translated to code. It is not guaranteed to be complete, stable, or performant enough to use as a full-fledged backend for expo-updates. Expo does not provide hands-on technical support for custom expo-updates server implementations, including what is in this repo. Issues within the expo-updates client library itself (independent of server) may be reported at https://github.com/expo/expo/issues/new/choose. Any pull requests that add new features to this repository will likely be closed; instead, feel free to fork the repository to add new features.

## Why

Expo provides a set of service named EAS (Expo Application Services), one of which is EAS Update which can host and serve updates for an Expo app using the [`expo-updates`](https://github.com/expo/expo/tree/main/packages/expo-updates) library.

In some cases more control of how updates are sent to an app may be needed, and one option is to implement a custom updates server that adheres to the specification in order to serve update manifests and assets. This repo contains an example server implementation of the specification and a client app configured to use the example server.

## Getting started

### Step-by-step: start server, dashboard, and client

1. Install dependencies for both projects:
   - `cd expo-updates-server && yarn`
   - `cd ../expo-updates-client && yarn`
2. Configure server environment in `expo-updates-server/.env.local`:
   - Set `HOSTNAME=http://localhost:3000`
   - Optionally set:
      cat > .env.local <<'EOF'
   HOSTNAME=HOST_NAME:3000
   DASHBOARD_ADMIN_USERNAME=admin
   DASHBOARD_ADMIN_PASSWORD=change123456@Qaz
   # PRIVATE_KEY_PATH=./code-signing-keys/private-key.pem
   EOF
3. Start the updates server + dashboard:
   - `cd expo-updates-server`
   - `yarn dev`
4. Open dashboard and sign in:
   - URL: `http://localhost:3000`
   - Default login:
     - Username: `admin`
     - Password: `change-me-now`
5. (Recommended) Create ingestion API keys in dashboard:
   - Go to API Keys section
   - Create `telemetry:write` key for `/api/telemetry/ack`
   - Create `logs:write` key for `/api/telemetry/log` if needed
6. Build and run release client:
   - iOS: `cd ../expo-updates-client && yarn ios --configuration Release`
   - Android: `cd ../expo-updates-client && yarn android --variant release`
7. Publish an update bundle:
   - `cd ../expo-updates-server`
   - `yarn expo-publish`
8. Test OTA flow:
   - Force close and reopen the release app
   - App requests `/api/manifest` and `/api/assets`
   - Dashboard should show device activity, logs, releases, and policies
9. Use control-plane operations from dashboard:
   - Create apps/channels (`production`, `staging`, `beta`)
   - Register/publish release
   - Promote between channels
   - Roll back to embedded
   - Filter logs and export CSV

### Updates overview

To understand this repo, it's important to understand some terminology around updates:

- **Runtime version**: Type: String. Runtime version specifies the version of the underlying native code your app is running. You'll want to update the runtime version of an update when it relies on new or changed native code, like when you update the Expo SDK, or add in any native modules into your apps. Failing to update an update's runtime version will cause your end-user's app to crash if the update relies on native code the end-user is not running.
- **Platform**: Type: "ios" or "android". Specifies which platform to to provide an update.
- **Manifest**: Described in the protocol. The manifest is an object that describes assets and other details that an Expo app needs to know to load an update.

### How the `expo-update-server` works

The flow for creating an update is as follows:

1. Configure and build a "release" version of an app, then run it on a simulator or deploy to an app store.
2. Run the project locally, make changes, then export the app as an update.
3. In the server repo, we'll copy the update made in #2 to the **expo-update-server/updates** directory, under a corresponding runtime version sub-directory.
4. In the "release" app, force close and reopen the app to make a request for an update from the custom update server. The server will return a manifest that matches the requests platform and runtime version.
5. Once the "release" app receives the manifest, it will then make requests for each asset, which will also be served from this server.
6. Once the app has all the required assets it needs from the server, it will load the update.

## The setup

Note: The app is configured to load updates from the server running at http://localhost:3000. If you prefer to load them from a different base URL (for example, in an Android emulator):
1. Update `.env.local` in the server.
2. Update `updates.url` in `app.json` and re-run the build steps below.

### Create a "release" app

The example Expo project configured for the server is located in **/expo-updates-client**.

#### iOS

Run `yarn` and `yarn ios --configuration Release`.

#### Android

Run `yarn` and then run `yarn android --variant release`.

### Make a change

Let's make a change to the project in /expo-updates-client that we'll want to push as an over-the-air update from our custom server to the "release" app. `cd` in to **/expo-updates-client**, then make a change in **App.js**.

Once you've made a change you're happy with, inside of **/expo-updates-server**, run `yarn expo-publish`. Under the hood, this script runs `npx expo export` in the client, copies the exported app to the server, and then copies the Expo config to the server as well.

### Send an update

Now we're ready to run the update server. Run `yarn dev` in the server folder of this repo to start the server.

In the simulator running the "release" version of the app, force close the app and re-open it. It should make a request to /api/manifest, then requests to /api/assets. After the app loads, it should show any changes you made locally.

## About this server

This server was created with NextJS. You can find the API endpoints in **pages/api/manifest.js** and **pages/api/assets.js**.

The code signing keys and certificates were generated using https://github.com/expo/code-signing-certificates.

## Dashboard and telemetry

The `expo-updates-server` app now includes a built-in dashboard at `/` and an API endpoint at `/api/dashboard`.

- UI stack:
  - Tailwind CSS for responsive layout
  - shadcn-style component structure under `expo-updates-server/components/ui`
- Dashboard pages:
  - `/dashboard` (Overview)
  - `/dashboard/releases`
  - `/dashboard/channels`
  - `/dashboard/devices`
  - `/dashboard/logs`
  - `/dashboard/api-keys`
  - `/dashboard/settings`

- The dashboard API aggregates:
  - request logs from `/api/manifest`, `/api/assets`, and telemetry endpoints
  - update bundle inventory from `expo-updates-server/updates/*/*`
  - device-level activity (`x-device-id`, `expo-device-id`, `expo-client-id`, or fallback fingerprint)

## Control plane features

This fork now includes:

1. Authentication and role-based access (admin/viewer) for dashboard and admin APIs.
2. Real device tracking with first/last seen and request counters.
3. Multi-app support (`appSlug`) and deployment channels (`channelName`).
4. Gradual rollouts with percentage, allowlist, and blocklist.
5. Update health ACK ingestion (`downloaded` / `applied` / `failed` / `rolled_back`).
6. Advanced logs with filters, pagination, and CSV export.
7. Release operations APIs for register/publish, promote, and rollback.
   - Actions are written to `admin_audit_logs` and shown in dashboard audit trail.
8. API key management with scopes for secure ingestion endpoints.
9. SQLite storage (`expo-updates-server/data/control-plane.sqlite`) replacing JSON event storage.
   - Includes `users`, `sessions`, `apps`, `channels`, `releases`, `channel_runtime_policies`, `devices`, `request_logs`, `update_acks`, and `admin_audit_logs`.

## Default credentials

- Username: `admin`
- Password: `change-me-now`

Override via environment variables:

- `DASHBOARD_ADMIN_USERNAME`
- `DASHBOARD_ADMIN_PASSWORD`

## Admin API overview

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET|POST /api/admin/apps`
- `GET|POST|PUT /api/admin/channels`
- `GET|POST /api/admin/releases`
- `POST /api/admin/promote`
- `POST /api/admin/rollback`
- `GET /api/admin/logs` (supports `format=csv`)
- `GET|POST|DELETE /api/admin/api-keys`

## Telemetry ingestion (API key required)

- `POST /api/telemetry/ack` with `x-api-key` or `Authorization: Bearer <key>`
  - Supports statuses `downloaded`, `applied`, `failed`, `rolled_back`, plus `reason` and `crashSignal`.
- `POST /api/telemetry/log` with `x-api-key` or `Authorization: Bearer <key>`

Suggested API key scopes:

- `telemetry:write` for ACK events
- `logs:write` for external log ingestion
- `admin` for full access
