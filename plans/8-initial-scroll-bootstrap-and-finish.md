## Plan

Fix two linked initial-scroll regressions in the example app and shared list core:

- index-based initial scroll briefly renders the top-of-list window before the target window
- non-animated initial scroll can reach the correct target on native but still wait for the Android watchdog timeout before finishing

The fix should preserve existing initial-scroll semantics outside these regressions and stay targeted to bootstrap/render-window seeding and finish detection.

## Goals

- Start rendering around the resolved initial target for index-based initial scroll instead of briefly exposing `0,1,2`.
- Finish non-animated initial scroll as soon as the target is already satisfied after layout, without waiting for native progress that may never arrive.
- Keep `hasScrolled` as a valid native-progress signal for cases where it still matters.

## Non-Goals

- No broad deferred-position refactor.
- No public API changes.
- No unrelated example cleanup.

## Verification

- targeted initial-scroll tests covering bootstrap windowing and finish behavior
- `bun test` for the touched suites
- manual Android repro on `example/app/initial-scroll-index-free-height`

## Steps

- [x] Add characterization coverage for the bad bootstrap window and watchdog-delayed finish behavior.
- [x] Seed initial render/windowing from the resolved initial target so index-based initial scroll does not briefly show top-of-list items.
- [ ] Let non-animated initial scroll finish when the target is already satisfied after layout, without removing `hasScrolled` as a native-progress signal.
- [ ] Run targeted verification and confirm the Android example now starts at the target window without the watchdog delay.
