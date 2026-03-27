---
name: debug
description: Debug the `legend-list` repo on web or mobile. Use when asked to reproduce or investigate a bug in `example-web/` or the Expo example app under `example/`, when Codex should open `http://localhost:5173` in a cmux browser, run the mobile example on iOS simulator or an attached Android device, deep link directly into a specific example route, add temporary structured logging, and repeatedly inspect runtime logs until extra logs no longer improve confidence or eight logging passes have been run.
---

# Debug

Use this skill as a repo-specific debug router. Prefer reproducible entrypoints, aggressive temporary logging, and log inspection over clicking around manually.

## Decide The Target

Choose one branch first:

- `web`: use `cmux-browser` and open `http://localhost:5173`
- `mobile`: use `agent-device`

If the user says only `debug mobile`, default to iOS simulator.
Use Android only when the user explicitly asks for Android or the bug is clearly Android-specific.

## Debug Web

Open the local web playground with `cmux-browser`:

```bash
cmux --json browser open http://localhost:5173
cmux browser <surface> get url
cmux browser <surface> wait --load-state complete --timeout-ms 15000
cmux browser <surface> snapshot --interactive
```

Use browser snapshots for interaction only when needed. Prefer reading console output and app logs over visual inspection unless the user specifically asks for visual confirmation.

If browser-side evidence is not enough, use `cmux` to find the dev-server surface in the current workspace and inspect its logs:

```bash
cmux identify --json
cmux list-panes --workspace <workspace>
cmux list-pane-surfaces --pane <pane>
cmux read-screen --surface <surface> --scrollback --lines 220
```

Look for `bun dev`, `vite`, or the surface serving the web playground.

## Debug Mobile

Prefer log-first debugging. Use UI snapshots only to confirm routing, element labels, or a visually reported problem.

### iOS

Use an iOS simulator by default. Pin the simulator once, then reuse the same `agent-device` session without repeating selectors on later commands.

```bash
agent-device ensure-simulator --platform ios --device "iPhone 17" --boot
agent-device open com.legendapp.listtest --platform ios --device "iPhone 17" --session debug-ios --relaunch
agent-device logs clear --restart --session debug-ios
```

If a session already exists, reuse it. After the session is bound, avoid repeating `--device` or `--udid` on later commands; a locked session can reject those overrides.

### Android

Never use the Android emulator for this repo.

Before doing anything else:

```bash
adb devices -l
```

If no physical Android device is attached, stop and ask the user to plug one in.

When using Android, start with Metro connectivity:

```bash
adb reverse tcp:8081 tcp:8081
```

Then pin a session to the attached device:

```bash
agent-device open com.legendapp.listtest --platform android --serial <serial> --session debug-android --relaunch
agent-device logs clear --restart --session debug-android
```

## Deep Link Directly Into Examples

Prefer deep linking to the specific example instead of navigating from the root list. In this repo, that is more reliable than clicking through the example home screen.

Derive the route from the file path under `example/app/`:

- `example/app/bidirectional-infinite-list/index.tsx` -> `/bidirectional-infinite-list`
- `example/app/initial-scroll-index/index.tsx` -> `/initial-scroll-index`

Derive the scheme and app id from repo config:

- read `example/app.json` for `expo.scheme` (`myapp` in this checkout)
- read `example/app.config.js` or `example/app.json` for the bundle id / Android package (`com.legendapp.listtest` in this checkout)

For this repo, prefer `open <app> <url>` over bare `open <url>`. The verified iOS pattern for `example/app/bidirectional-infinite-list/index.tsx` is:

```bash
agent-device open com.legendapp.listtest myapp://bidirectional-infinite-list --session debug-ios
```

Use the same pattern for other example routes by swapping the path.

If `open <url>` alone leaves the app on the root screen or bounces into `AgentDeviceRunner`, reopen the app and retry with `open <app> <url>`.

After deep linking, confirm the destination with logs or a snapshot:

```bash
agent-device snapshot -i --session debug-ios
```

## Find Metro And App Logs

If `agent-device` logs are sufficient, use them first:

```bash
agent-device logs path --session debug-ios
agent-device logs clear --restart --session debug-ios
```

If you cannot get useful logs through `agent-device`, use `cmux` to find the nearby `bun start` or `expo start` surface in the current workspace and inspect that output:

```bash
cmux identify --json
cmux list-panes --workspace <workspace>
cmux list-pane-surfaces --pane <pane>
cmux read-screen --surface <surface> --scrollback --lines 220
```

Look for the Metro surface first. In this repo it often appears as `bun start --localhost`, `bun start`, or `expo start`.

## Instrument With Heavy Temporary Logs

This repo debugs best with lots of temporary logging. Add logs at causal boundaries, not just at symptoms:

- state writes
- render/effect boundaries
- scroll ownership transitions
- item size/layout updates
- prepend/append transaction paths
- maintain-position logic

Use a stable prefix, absolute timestamp, and debug id:

```ts
const ts = Date.now();
const debugId = "prepend-debug-v1";
console.log(`${ts} [debug legend-list ${debugId}] event-name`, {
    seq: ++seq,
    ...payload,
});
```

Prefer one investigation loop with a hard cap of eight passes:

1. Add broad but targeted logs.
2. Clear or restart log capture.
3. Reproduce automatically through a deep link or web entrypoint.
4. Inspect only the relevant log window.
5. Decide whether any additional logs could still increase confidence or distinguish between plausible causes.
6. If yes, add narrower or cross-checking logs and repeat the loop, even if you already think you know the problem.
7. Stop only when extra logs are unlikely to improve confidence or when you have completed eight logging passes.
8. Remove the temporary logs after the fix is confirmed.

Treat "I am already pretty sure" as insufficient reason to stop when more logs could still make the conclusion stronger. Continue until the evidence feels saturated or the eight-pass cap is reached.

If automatic reproduction or log collection is blocked, fall back to asking the user for a fresh reproduction and a cutoff timestamp, then continue the same logging loop.

## Stop Rules

Stop and ask the user when:

- Android debugging is requested but no physical device is attached
- the repo config no longer matches the current scheme or app id
- the bug depends on a visual detail that logs cannot confirm

Otherwise keep iterating until the logs isolate the fault line, clearly rule out the suspected path, or stop adding meaningful confidence after up to eight passes.
