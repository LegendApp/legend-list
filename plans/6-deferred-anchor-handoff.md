## Plan

Replace deferred-geometry's raw-delta flush model with an anchor-based handoff so upward scrolling remains stable during measurement churn and does not jump when idle flush runs.

## Goals

- Treat deferred geometry as temporary anchor-preservation state, not a bucket of scroll debt.
- Preserve the currently visible anchor while scrolling upward through late measurements.
- Settle only residual anchor error on idle flush instead of cashing out gross accumulated measurement diffs.
- Keep ownership transitions explicit between bootstrap, deferred geometry, MVCP, and direct scroll.
- Preserve current prepend and bootstrap behavior unless needed for the anchor handoff.

## Non-Goals

- Do not redesign the public MVCP API.
- Do not broaden behavior changes outside deferred-geometry stabilization and its handoff.
- Do not add a heavyweight controller or new runtime abstraction layer.

## Implementation Outline

- Extend deferred geometry state with anchor-relative fields:
  - anchor key / index hint
  - desired viewport offset
  - last measured anchor offset
  - residual anchor error
  - projected delta and pending size shift for active-scroll projection
- Capture and refresh that anchor when `deferred_geometry` owns stabilization in `calculateItemsInView`.
- Recompute residual anchor error from current measured positions each deferred pass instead of treating `delta` as flushable truth.
- Change deferred flush to settle residual anchor error only, then reset deferred state and trigger a full position pass.
- Keep near-viewport measurement changes participating in anchor recomputation even when their size impact is absorbed by deferred geometry.

## Guardrails

- Maintain existing cap behavior for active deferred projection unless it conflicts with anchor correctness.
- Keep compatibility shims for legacy `deferredPositionDelta` / `pendingDeferredSizeShift` tests until the core tests are updated.
- Avoid reverting unrelated in-flight work in the dirty tree.
- Keep helper logic small and pure; the architecture change should reduce ambiguity, not add indirection.

## Verification

- Focused core suites:
  - `bun test __tests__/core/deferredPositionState.test.ts`
  - `bun test __tests__/core/calculateItemsInView.test.ts`
  - `bun test __tests__/core/updateItemSize.test.ts`
  - `bun test __tests__/core/scrollTo.test.ts`
- Add a regression that simulates upward scrolling with above-viewport shrink measurements and asserts no large idle flush remains.
- Manual iOS example verification in `example/app/bidirectional-infinite-list` after the core refactor lands.

## Steps

- [x] Add anchor-based deferred geometry state and helper APIs while keeping compatibility accessors intact.
- [ ] Rework deferred-geometry pass calculation to capture an anchor and derive residual anchor error from measured positions.
- [ ] Update measurement handling and flush handoff so absorbed near-viewport rows still feed anchor reconciliation and idle flush settles residual error only.
- [ ] Add regression tests, run the focused verification loop, and confirm the iOS bidirectional example no longer jumps after upward scroll settles.
