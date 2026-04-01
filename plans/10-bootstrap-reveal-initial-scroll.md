## Plan

Add a new internal bootstrap-reveal initial-scroll strategy behind a global code flag:

- keep the public API unchanged
- switch strategies at the top-level initial-scroll boundary in `LegendList`
- use hidden bootstrap convergence for `initialScrollIndex` and `initialScrollAtEnd`
- leave `initialScrollOffset` on its existing direct-offset path
- keep the old strategy available behind the flag until the new path is proven, then remove the flag and old behavior in a later cleanup

## Decisions

- `readyToRender` stays `false` until hidden bootstrap has converged and the final reveal step is complete
- native keeps mount `contentOffset` seeding; web skips DOM mount scroll but still seeds internal bootstrap scroll state
- bootstrap state is separate from live scroll state
- `calculateItemsInView` may read bootstrap scroll only while the bootstrap session is active
- keep only a minimal bootstrap search seed (`targetIndex`), not a separate bootstrap buffered range
- bootstrap suppresses MVCP, threshold callbacks, viewability, and other settled-viewport side effects
- final correctness means exact first reveal geometry for all viewport-intersecting items, including partially visible edges
- offscreen prefix items above the reveal window may remain estimated
- `initialScrollAtEnd` keeps full footer/padding/header/view-offset semantics
- zero-target origin cases still short-circuit
- empty `initialScrollAtEnd` still finishes at origin and rearms when data arrives
- data-length or footer changes during bootstrap invalidate the pending result and continue hidden convergence
- bounded bootstrap failure falls back to deterministic origin/top reveal with loud DEV diagnostics, not to the old visible retry path

## Goals

- remove visible initial-scroll jump and repeated follow-up scroll behavior in the new strategy
- keep the first revealed frame exact for all items on screen
- preserve current anchor semantics for `initialScrollIndex` object form and `initialScrollAtEnd`
- make the strategy boundary easy to test by flipping one internal flag
- keep the first rollout additive so behavior can be compared directly against the old strategy

## Non-Goals

- no public prop or API changes
- no bootstrap participation for `initialScrollOffset`
- no use of MVCP during bootstrap
- no mixed old/new repair ownership inside the same initial-scroll session
- no immediate deletion of the old strategy before the new one is proven

## Target Model

### Strategy Boundary

Add a global internal config flag that selects one complete initial-scroll strategy:

- `legacy`: current behavior
- `bootstrapReveal`: new hidden bootstrap-reveal path

The switch should live where `LegendList` wires initial-scroll target resolution, manager ownership, layout hooks, and initial content offset behavior.

### Bootstrap Session

The new strategy should track only the hidden bootstrap state it needs:

- `bootstrapScroll`
- `bootstrapTargetIndexSeed`
- bootstrap-active / reveal-pending flags
- convergence counters and last stable reveal snapshot

Do not overload live `state.scroll` with bootstrap-only values.

### Bootstrap Execution

1. Resolve the initial target using the current public semantics.
2. If the target is already satisfied at origin, finish immediately with the existing zero-target fast path.
3. Start a bootstrap session for `initialScrollIndex` or `initialScrollAtEnd`.
4. Seed native mount `contentOffset`; on web leave the DOM at `0`.
5. Seed internal bootstrap scroll state and first-pass target-index search hint.
6. Run hidden `calculateItemsInView` passes using bootstrap scroll, not live scroll.
7. Measure the provisional reveal window and recompute the final post-correction reveal geometry.
8. Continue hidden passes until the reveal result is stable.
9. If native mount seed already matches the final target within epsilon, skip corrective `scrollTo`.
10. Otherwise apply one final correction:
    - native: one final corrective scroll if needed
    - web: one explicit DOM scroll, then wait one extra frame
11. Reveal and clear all bootstrap-only state immediately.

### Convergence Rule

Bootstrap may reveal only when all of the following are true for 2 consecutive hidden passes:

- the resolved final anchor offset matches within epsilon
- the set of viewport-intersecting items in the final post-correction viewport is unchanged
- every item in that reveal window, including partially visible edge items, has an exact measurement

Do not require buffered-window identity to stay fixed.

### Invalidation Rules

During bootstrap, restart hidden convergence when any of these change the reveal result:

- data length / structural data change
- footer size changes for `initialScrollAtEnd`
- layout changes that alter scroll length or visible geometry
- target semantics change

### Fallback

If bootstrap exceeds bounded pass-count or frame-count limits:

- abort the bootstrap session
- reveal deterministically at origin/top
- log a loud DEV-only diagnostic
- do not reintroduce the old visible retry/correction behavior

## Steps

- [x] Add the plan coverage, strategy flag, and bootstrap-specific test scaffolding for hidden convergence and deterministic fallback.
- [ ] Add a new bootstrap-reveal initial-scroll strategy boundary in `LegendList` and keep `initialScrollOffset` on the existing direct path.
- [ ] Teach `calculateItemsInView` to consume bootstrap scroll and a minimal target-index seed while suppressing bootstrap-time side effects.
- [ ] Implement hidden convergence, reveal-window stability tracking, and one-shot final correction for native and web.
- [ ] Handle edge cases: zero-target fast path, empty `initialScrollAtEnd` rearm, footer invalidation, data-change restart, and bootstrap abort-to-origin fallback.
- [ ] Run focused verification against both strategies, compare first-reveal behavior, and record the outcome before any cleanup pass.

## Verification

Focused verification for the first rollout:

- `bun test __tests__/components/InitialScrollManager.managed.test.ts __tests__/components/LegendList.managed.initialScroll.test.tsx __tests__/components/LegendList.initialScroll.integration.test.tsx __tests__/components/LegendList.initialScroll.oldArchitecture.test.tsx __tests__/components/LegendList.props.test.tsx __tests__/components/LegendList.initialScrollThresholds.test.tsx __tests__/components/initialScrollRunners.test.ts __tests__/utils/setDidLayout.test.ts __tests__/core/checkFinishedScroll.test.ts __tests__/core/finishScrollTo.test.ts --timeout 15000`
- add focused bootstrap-reveal tests for:
  - hidden convergence of viewport-intersecting items
  - native seed with zero final correction when already aligned
  - web final scroll plus one-frame delayed reveal
  - empty `initialScrollAtEnd` rearm on data arrival
  - footer invalidation during hidden bootstrap
  - abort-to-origin fallback after bounded hidden passes/frames
- `bun run tsc:src`

## Cleanup Follow-Up

After the new strategy is validated:

- remove the global strategy flag
- delete the old initial-scroll strategy and bypasses
- collapse shared helpers back to one ownership model
