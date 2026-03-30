## Plan

Preserve the current deferred-position behavior exactly while simplifying ownership and removing duplicate complexity. The current branch is the behavior baseline. Refactors should not intentionally change user-visible behavior unless they expose a real bug, and any bug fix must start with a failing test.

## Primary Goal

Improve the architecture around deferred positions, prepend measurement ownership, MVCP handoff, and initial-scroll orchestration without changing the branch's current behavior.

## Non-Goals

- No semantic restart from `web`.
- No new deferred-position model.
- No sparse/shadow `positions[]` architecture.
- No performance regressions in hot paths.
- No cleanup-only deletions before characterization coverage is in place.

## Behavior Baseline

Treat the current `deferred-rewrite-mar28` branch as the reference implementation for:

- deferred initial scroll settling
- `initialScrollAtEnd` empty-mount and data-arrival behavior
- prepend measurement ownership across data change and item measurement
- Android gating: deferred initial scroll stays enabled, runtime deferred sessions stay disabled
- exact-read flush boundaries for offsets, imperative reads, and snap offsets
- canonical flush compensation and idle/visible-interaction flush behavior

## Guardrails

- `positions[]` remains the only canonical position model.
- Deferred state remains temporary and must not duplicate canonical compensation.
- Exact-read consumers must continue to flush unless they are on the deferred-initial path that already depends on temporary render positions.
- Prepend measurement ownership must remain stable through MVCP -> item measurement -> deferred flush handoff.
- Every behavioral change discovered during cleanup must begin with a failing test that reproduces the issue on the cleanup branch.
- Keep the cleanup incremental. If a step broadens the scope, stop and split it.

## Phase 1: Characterization Coverage

Expand test coverage before making architectural changes.

### Add characterization tests for deferred positions

- Cover deferred render positions above and below the anchor with multiple resize sequences.
- Cover visible-interaction flushes, scroll-unsafe flushes, idle flushes, and exact-read flushes.
- Cover published-size-floor behavior during end-aligned deferred initial scroll settle.
- Cover canonical flush compensation when the visible anchor differs from the deferred anchor.

### Add characterization tests for prepend ownership

- Cover pure prepend data changes where prepended rows measure over multiple item-size callbacks.
- Cover prepend measurement ownership remaining stable across intermediate MVCP recalculations.
- Cover prepend completion flushing exactly once with the expected compensation.
- Cover Android behavior that skips runtime prepend/deferred sessions while preserving deferred initial scroll.

### Add characterization tests for initial scroll

- Cover `initialScrollIndex`, `initialScrollOffset`, and `initialScrollAtEnd`.
- Cover empty mount, data arriving after layout, data arriving before layout, and footer relayout.
- Cover "already at resolved target" no-op behavior.
- Cover retry-window behavior and "user moved away" no-retry behavior.
- Cover non-animated deferred initial scroll completion when native progress is no longer needed.

### Add characterization tests for exact-read consumers

- Cover `calculateOffsetForIndex`.
- Cover imperative `positionAtIndex` / `positionByKey`.
- Cover `snapToOffsets` recomputation.
- Cover any other exact offset reads touched by deferred state.

## Phase 2: Document Invariants

Create a small invariant section in the relevant plan or code comments that captures the contracts the cleanup must preserve.

- deferred state is temporary
- canonical positions live in `positions[]`
- published size may differ from exact size only for clamp-sensitive deferred initial-scroll settle
- prepend ownership and runtime deferred ownership must not overlap incorrectly
- initial-scroll target resolution and retry logic must preserve current outputs

## Invariant Checklist

These are the contracts every cleanup step must preserve.

### Canonical layout

- `positions[]` is always the single canonical offset model.
- Deferred mode may change render/windowing reads, but it must not leave duplicate compensation in both deferred state and canonical positions.
- Exact-read consumers are allowed to force canonicalization before returning offsets.

### Deferred ownership

- There is at most one active deferred session.
- Deferred sessions keep a stable anchor for their lifetime and flush instead of silently rebasing to a different anchor.
- Published content size may exceed exact size only while a clamp-sensitive deferred initial-scroll session is active.

### Prepend ownership

- Pure prepend data changes may open a prepend measurement window.
- While that window owns the transition, deferred compensation must remain attached to the prepend anchor until the tracked prepended keys are measured or the session flushes.
- Runtime deferred resize handling must not steal ownership from prepend measurement mid-transition.

### Initial scroll

- Initial-scroll target normalization stays deterministic for index, offset-only, and end-aligned targets.
- If the resolved target is already satisfied, cleanup must not introduce a redundant native scroll.
- Retry/rearm behavior for empty mount, async data arrival, retry windows, and footer-driven end-offset changes must keep the same outcomes as the current branch.

### Platform behavior

- Android keeps deferred initial scroll behavior.
- Android does not allow runtime deferred resize sessions or prepend measurement ownership while actively scrolling.
- Web MVCP anchor-lock and native MVCP remainder handling must remain behaviorally unchanged unless a test-first bug fix is required.

## Phase 3: Consolidate Deferred Ownership

Refactor ownership without changing behavior.

### Target shape

- `src/core/deferredPositions.ts` owns deferred-session lifecycle, flush rules, prepend-window lifecycle, and helper decisions.
- `src/core/updateItemSize.ts` becomes a thin caller that reports size diffs and executes the result.
- `src/core/mvcp.ts` remains focused on MVCP anchor selection and adjustment math, not deferred-session maintenance.
- `src/core/updateScroll.ts` remains focused on scroll state transitions and delegates deferred idle behavior.

### Expected cleanup work

- Move prepend-measurement-window lifecycle helpers out of `mvcp.ts` and `updateItemSize.ts` into deferred ownership.
- Reduce duplicate checks for deferred-initial-scroll vs runtime-deferred behavior.
- Simplify flush entry points so one module decides rebase vs recompute vs compensation.

## Phase 4: Simplify Initial Scroll Orchestration

Refactor `LegendList.tsx` to reduce duplicated target setup and retry logic without changing outcomes.

### Target shape

- one path for initial target normalization
- one path for activating deferred initial scroll
- one path for retry / rearm decisions
- one path for footer-driven end-target updates

### Constraints

- preserve empty-data rearm behavior
- preserve retry-window behavior
- preserve "already at resolved target" no-op behavior
- preserve offset-only special handling
- preserve old-architecture/native fallback behavior

## Phase 5: Remove Dead or Duplicate Logic

Only after the characterization suite stays green through Phases 3 and 4:

- remove duplicate branches that no longer own state
- remove stale intermediate fields only if they are proven unused
- tighten helper APIs so ownership is explicit

## Verification

Run after each phase, and after each non-trivial refactor step inside a phase:

- `bun test __tests__/core/deferredPositions.test.ts __tests__/core/updateItemSize.test.ts __tests__/core/prepareMVCP.test.ts __tests__/core/calculateItemsInView.test.ts __tests__/core/finishScrollTo.test.ts __tests__/core/updateScroll.test.ts __tests__/components/LegendList.props.test.tsx`
- any newly added characterization suites for prepend or initial-scroll integration
- targeted manual checks in example apps for:
  - prepend measurement stabilization
  - resize-before-anchor while scrolling
  - `initialScrollAtEnd` with late footer layout
  - Android runtime scrolling behavior vs deferred initial scroll

Record any pre-existing unrelated failures separately instead of folding them into the cleanup.

## Stop Conditions

Stop and reassess if any of these happen:

- a refactor needs new state that duplicates existing deferred compensation
- a cleanup step requires changing the intended behavior without a clear bug reproduction
- characterization tests reveal current branch behavior is internally inconsistent
- performance on the focused suites or example repros gets worse in a way that suggests more recalculation or more scroll adjustments

## Steps

- [x] Expand characterization coverage for deferred positions, prepend ownership, initial scroll, and exact-read consumers.
- [x] Write down the invariant contracts the cleanup must preserve.
- [x] Consolidate deferred-position ownership into fewer modules without changing behavior.
- [ ] Simplify initial-scroll orchestration in `LegendList.tsx` without changing outcomes.
- [ ] Remove dead or duplicate logic only after coverage proves ownership is stable.
- [ ] Run the focused verification matrix and manual repro set after each step.
