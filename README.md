# SurvivalAI

Offline-first wilderness and emergency survival assistant for iOS and Android.
Built with Expo (SDK 54) and expo-router.

The premise is that the phone has to be useful when the infrastructure is not:
the knowledge base, the calculators, the Morse signalling and the peer
discovery all work with no network at all.

## Features

| Screen | What it does |
|---|---|
| Home | Status dashboard and quick actions, with a 20-language picker |
| Chat | Survival AI assistant — local knowledge base, on-device LLM, or a hosted API |
| Calculator | Water, food and supply planning for a group over time |
| Morse | Flashlight transmission and camera-based decoding of light signals |
| Notes | Offline field notes |
| Board | Community message board (needs a server — see below) |
| Seeking | Broadcast a rescue beacon over local WiFi, or scan for others |
| Room | Peer-to-peer chat over the local network, no internet needed |

### Chat modes

1. **Knowledge** — a bundled survival corpus, searched locally. Always available.
2. **Offline LLM** — a GGUF model run on-device via `llama.rn`. Models are
   downloaded in-app; the smallest is ~1 GB and the default ~2.3 GB.
3. **Online** — OpenAI, or any OpenAI-compatible endpoint you configure.

Mode 1 needs nothing. Mode 2 needs disk and RAM. Mode 3 needs an API key, which
is stored on-device and never sent anywhere but the endpoint you name.

## Running locally

```bash
npm install
npx expo start
```

Most features need a **custom dev client**, not Expo Go — the UDP beacon, the
TCP room chat, the on-device LLM and speech recognition are all native modules:

```bash
npx expo run:ios      # or: npx expo run:android
```

Expo Go will load the app but those screens degrade to an explanatory message
rather than crashing.

## Configuration

### Board server

The board is the one feature that needs infrastructure. It ships **unset**, and
the screen shows a setup prompt until a server is configured. Point it at one
either at build time:

```json
// app.json
"extra": { "boardServerUrl": "https://board.example.com" }
```

…or per device, in the board screen's settings sheet.

The server lives in [`server/`](server/README.md) — Node, Express and SQLite.

### Push notifications

Board subscriptions need an EAS project id in `app.json`:

```json
"extra": { "eas": { "projectId": "<your-eas-project-id>" } }
```

Standalone builds cannot infer it, so push token requests fail without it. The
app warns in the log rather than crashing. Permission is requested when the user
subscribes, not at launch.

### Network security

Cleartext HTTP to the public internet is blocked on both platforms. Loopback,
the Android emulator host and mDNS `.local` names stay permitted so a
self-hosted board server on a LAN still works — see
[`plugins/withLocalNetworkSecurity.js`](plugins/withLocalNetworkSecurity.js).

A public board server must therefore be HTTPS.

## Checks

```bash
npx tsc --noEmit   # types
npm run lint       # eslint
```

Both are expected to be clean. Lint still reports warnings (mostly
`no-inline-styles` and `no-explicit-any`); errors are the bar.

## Building for release

Builds go through EAS:

```bash
eas build --profile production --platform all
```

Before the first submission, fill in the placeholders in `eas.json` →
`submit.production`:

- `ios.appleId`, `ios.ascAppId`, `ios.appleTeamId`
- `android.serviceAccountKeyPath` — the Google Play service account JSON.
  Keep it out of git; `.gitignore` covers it.

Versioning is remote (`appVersionSource: "remote"` with `autoIncrement`), so
build numbers are managed by EAS rather than committed.

### `app.json` vs the native folders — read this before editing app.json

`android/` and `ios/` are committed, which puts the project in the **bare**
workflow. EAS Build uses those folders as-is and **does not run config plugins
or sync these `app.json` fields**:

> `orientation`, `icon`, `userInterfaceStyle`, `scheme`, `primaryColor`,
> `splash`, `ios`, `android`, `plugins`

So a permission, plugin or Info.plist change made only in `app.json` will look
correct in the file and have no effect on a real build. Both sides are
currently in sync — the manifests were updated by hand to match — but that is a
standing maintenance cost.

Two ways to keep it honest, pick one:

- **Stay bare.** Treat `android/app/src/main/AndroidManifest.xml` and
  `ios/SurvivalAI/Info.plist` as the source of truth, and mirror any `app.json`
  change into them. Anything a new library's config plugin would have injected
  must be added manually — see the `expo-speech-recognition` queries block in
  the Android manifest for an example of what that looks like.
- **Go CNG.** Delete `android/` and `ios/`, let `npx expo prebuild` generate
  them from `app.json`, and add them to `.gitignore`. Plugins then run and
  `app.json` becomes authoritative. This discards any hand-edits currently in
  those folders, so diff them first.

### Permissions

The app declares only what it exercises:

| Permission | Used by |
|---|---|
| Camera | Morse decoding, flashlight torch |
| Microphone + speech recognition | Voice input in chat |
| Location (when in use) | Coordinates in Seeking mode |
| Local network | UDP beacons, TCP room chat |
| Notifications | Board subscriptions |

There is no Bluetooth, no background location and no external storage access.
The rescue beacon is WiFi UDP broadcast, despite what older naming suggested.

## Project layout

```
app/            expo-router screens; (tabs)/ is the tab bar
components/     per-screen UI pieces
services/       all the logic — LLM, beacons, Morse, i18n, storage
data/           bundled survival knowledge corpus
constants/      theme and Morse tables
plugins/        local Expo config plugins
server/         board API (see server/README.md)
website/        marketing site + privacy/terms, deployed to Cloudflare Pages
```

`services/` is where the interesting work is and where changes usually belong;
screens are mostly presentation over those modules.
