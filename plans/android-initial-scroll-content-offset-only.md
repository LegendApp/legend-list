# Android Initial Scroll Plan

## Goal

Use the ScrollView `contentOffset` prop as the only native bootstrap positioning command on Android.
Do not issue bootstrap `scrollTo` calls.
Instead, keep the requested initial anchor visually fixed with a separate bootstrap projection offset until the list can hand off cleanly to normal scroll ownership.

## Why Change Direction

The previous deferred-bootstrap attempt mixed three different owners of the same initial anchor:

- native `contentOffset`
- bootstrap-time deferred geometry
- corrective `scrollTo`

That hybrid caused overscroll, clamp churn, and prepend jumps.
The next attempt should keep bootstrap as a stricter temporary mode with its own offset and ownership rules.

## Core Idea

Introduce a bootstrap-only visual offset, tentatively `bootstrapVisualOffset`.

- Native `contentOffset` is still the initial seed.
- `bootstrapVisualOffset` is separate from steady-state `deferredPositionDelta`.
- Bootstrap adjusts what the list renders and reads as visible during the initial phase.
- Bootstrap never uses native corrective scrolling.
- Bootstrap hands off by rebasing once into normal coordinates, then clearing bootstrap mode.

Conceptually:

- canonical item positions stay in content space
- bootstrap anchor contract defines where the target item should appear
- `effectiveBootstrapScroll = nativeScroll + bootstrapVisualOffset`

## Scope

V1 should stay narrow:

- Android only
- vertical, single-column only
- new architecture only if that reduces risk
- support `initialScrollIndex`, `initialScrollOffset`, and `initialScrollAtEnd`
- exclude sticky headers, masonry, grids, horizontal lists, and `overrideItemLayout`
- do not merge bootstrap projection with normal deferred-position rebases yet

## Constraints

- No bootstrap `scrollTo`
- No corrective native scroll after mount for bootstrap ownership
- Keep readiness and threshold gating closed until bootstrap handoff
- Do not let prepend, MVCP, and bootstrap write to the same offset independently
- Preserve a fallback to the old initial-scroll path until the new path is proven

## Bootstrap Contract

### Native Ownership

- `contentOffset` is the only native bootstrap positioning input.
- Native scroll events are observed, not corrected.
- Clamp is accepted as native truth; bootstrap reconciles around it instead of chasing the ideal target with `scrollTo`.

### Bootstrap Ownership

- Bootstrap stores a target contract:
  - target key
  - target index hint
  - requested `viewPosition`
  - requested `viewOffset`
  - current desired anchor placement
- Bootstrap stores a temporary visual offset:
  - `bootstrapVisualOffset`
- Bootstrap computes visibility/range/readiness from:
  - `effectiveBootstrapScroll = state.scroll + bootstrapVisualOffset`

### Finish Ownership

- Bootstrap finishes only when the anchor is stable enough to rebase into normal coordinates.
- Completion is owned by bootstrap, not by native `scrollTo` settle logic.
- The old retry/watchdog path should remain available as fallback while this ships.

## Offset Update Rules

`bootstrapVisualOffset` should be updated only from explicit structural causes, not from a generic "close the gap" control loop.

Allowed causes:

- size changes above the bootstrap anchor
- pure prepends above the anchor
- header/footer/inset changes that move the requested anchor placement
- viewport size changes that affect `viewPosition`

Disallowed causes:

- recomputing `bootstrapVisualOffset = desiredOffset - state.scroll` every pass
- steady-state deferred boundary flushes
- MVCP rebases
- corrective native `scrollTo`

## Handoff Model

Bootstrap handoff should be one-way:

1. Start from seeded native `contentOffset`
2. Render using `bootstrapVisualOffset`
3. Observe real native scroll/layout/measurement changes
4. Accumulate only explicit anchor-relative deltas into `bootstrapVisualOffset`
5. Once stable, rebase the projection into canonical positions or the steady-state deferred coordinate space
6. Clear bootstrap mode and resume normal MVCP / threshold behavior

If prepend or another unsupported structural change happens before safe handoff:

- either pause bootstrap progression until the staged change is fully measured
- or bail out to the legacy path

Do not partially hand off while structural work is still pending.

## Plan

### 1. Define a Separate Bootstrap State Surface

- Add bootstrap-specific state that is not reused by steady-state deferred flush logic:
  - `bootstrapAnchorKey`
  - `bootstrapAnchorIndexHint`
  - `bootstrapViewPosition`
  - `bootstrapViewOffset`
  - `bootstrapVisualOffset`
  - `bootstrapObservedNativeScroll`
  - `bootstrapPendingRebase`
- Keep this separate from `deferredPositionDelta` for v1.

### 2. Route Bootstrap Reads Through Anchor Projection

- During bootstrap, calculate visible range and readiness using `effectiveBootstrapScroll`.
- Keep canonical item positions in content space.
- Ensure threshold checks stay gated until bootstrap finishes.
- Keep non-bootstrap behavior unchanged.

### 3. Update Bootstrap Offset from Explicit Causes Only

- Add helpers that update `bootstrapVisualOffset` only when:
  - items above the anchor resize
  - prepended items are inserted above the anchor
  - header/footer/inset/viewport changes move the requested anchor placement
- Do not use a generic full-pass recomputation from `desiredOffset - state.scroll`.

### 4. Isolate Bootstrap from Steady-State Deferred Logic

- Prevent normal deferred boundary flushes/rebases from touching `bootstrapVisualOffset`.
- Prevent MVCP from rebasing bootstrap state while bootstrap is active.
- Keep bootstrap projection temporary and self-contained.

### 5. Stage Prepend Interaction Instead of Letting It Fight Bootstrap

- If prepend happens during bootstrap, either:
  - stage inserted items until they are measured, then apply one bootstrap-aware commit
  - or fall back to the legacy path if the shape is unsupported
- Do not let prepend and bootstrap both mutate visible positions independently in the same phase.

### 6. Add a One-Time Rebase Handoff

- Define a single handoff point where bootstrap projection is converted into steady-state coordinates.
- Rebase once after:
  - bootstrap anchor is stable
  - no staged prepend transaction is pending
  - no synthetic scroll-adjust state is pending
  - MVCP is still gated
- After rebase:
  - clear bootstrap state
  - reopen threshold and readiness gates
  - resume normal MVCP/deferred behavior

### 7. Keep a Safe Fallback Path

- Do not delete the old Android initial-scroll retry/watchdog path yet.
- Gate the new bootstrap projection path behind strict support checks.
- If bootstrap sees unsupported layout, disappearing anchor, or unresolved structural churn, fall back instead of forcing the projection model through.

### 8. Tighten Tests Around Projection Ownership

- Add regression coverage for:
  - start-at-end bootstrap with no bootstrap `scrollTo`
  - clamp-at-end with no corrective native scroll
  - size changes above anchor preserving target placement
  - prepend during bootstrap via staged commit or fallback
  - readiness staying closed until bootstrap rebase handoff
  - no normal deferred flush touching bootstrap offset

### 9. Verify with Repeated Android Runs

- Re-run `example/app/initial-scroll-start-at-the-end` repeatedly.
- Inspect logs for:
  - seeded native `contentOffset`
  - bootstrap anchor contract
  - bootstrap offset updates and their causes
  - no bootstrap `scrollTo`
  - one-time rebase handoff
- Stop only when repeated runs show:
  - no underscroll-then-correct behavior
  - no prepend jump during bootstrap
  - no blank mount
  - no delayed reveal caused by waiting forever for native settle

## Decisions

### Separate Primitive First

Bootstrap should start with its own offset field and ownership rules.
Do not merge it into `deferredPositionDelta` until the behavior is proven stable.

### Anchor-Relative Updates Only

The bootstrap offset should move only because something relative to the anchor changed.
It should not be recomputed each pass from the whole scroll state.

### Handoff Must Be Explicit

Bootstrap should not gradually blur into steady-state deferred behavior.
There should be one deliberate rebase point and then bootstrap mode ends.

### Fallback Stays

The old path should remain until the projection path is green in repeated Android runs and prepend cases.
