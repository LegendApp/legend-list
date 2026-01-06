## Plan
Add a web-only synchronous render path for large scroll jumps to prevent brief blank frames during scrollbar drags while keeping native behavior unchanged.

## Platform Wiring
- Add `src/platform/flushSync.ts` that exports a `flushSync` wrapper around `react-dom`'s `flushSync`.
- Add `src/platform/flushSync.native.ts` that exports the same signature but directly executes the callback.
- Keep the API to a simple `flushSync(fn: () => void): void` to avoid React DOM types leaking into core code.

## Scroll Delta Trigger
- In `src/core/updateScroll.ts`, capture `prevScroll = state.scroll` before mutating and compute `scrollDelta = Math.abs(newScroll - prevScroll)`.
- Use `state.scrollLength` (viewport size) as the threshold; guard with `scrollLength > 0` and skip when `scrollingTo` is active if needed.
- When `shouldUpdate` is true and `Platform.OS === "web"` and `scrollDelta > scrollLength`, wrap the `triggerCalculateItemsInView` + `checkAtBottom` + `checkAtTop` block in `flushSync`; otherwise run it normally.
- Leave scroll history, MVCP handling, and throttling logic unchanged so only the update timing changes.

## Tests & Manual Verification
- Add a unit test for `updateScroll` that stubs the flushSync wrapper and asserts it runs only for large deltas on web (and never on non-web).
- Ensure native builds do not import `react-dom` by running lint/type checks and a native test build if available.
- Manual check in `example-web`: drag the scrollbar thumb across large distances and confirm no blank frames, then verify small wheel scrolls behave normally.

## Steps
- [x] Add platform-specific `flushSync` wrapper modules and import the helper where needed.
- [ ] Update `src/core/updateScroll.ts` with scroll-delta detection and conditional sync flushing.
- [ ] Add/adjust tests and record manual verification steps for web behavior.
