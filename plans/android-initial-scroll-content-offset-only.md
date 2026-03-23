# Android Initial Scroll Plan

## Goal

Use the ScrollView `contentOffset` prop as the only native initial-scroll command path.
Do not issue follow-up bootstrap `scrollTo` calls.
Instead, keep rendering aligned through deferred-position reconciliation until the first real native scroll state is known.

## Constraints

- Avoid blank states caused by waiting forever for a bootstrap scroll to settle.
- Preserve `waitForInitialLayout` behavior, but redefine "initial scroll finished" around reconciliation rather than `scrollTo` completion.
- Keep Android clamp handling explicit: a clamped first `onScroll` should reconcile geometry, not trigger another corrective `scrollTo`.
- Keep the change narrow to the initial-scroll bootstrap path.

## Plan

### 1. Trace the Current Bootstrap Ownership

- Map every place where initial scroll is represented today:
  - seeded `initialContentOffset`
  - logical bootstrap scroll state in item calculation
  - follow-up `performInitialScroll` calls from layout/bootstrap hooks
  - `didFinishInitialScroll` / `readyToRender` transitions
- Classify each use as either:
  - native command ownership
  - logical rendering ownership
  - completion/gating ownership

### 2. Define the New Bootstrap Contract

- `contentOffset` is the only native initial positioning command.
- `state.initialScroll` becomes a logical bootstrap target used for rendering and reconciliation.
- A first reconciliation event marks bootstrap completion:
  - preferred: first real `onScroll`
  - fallback: deterministic no-scroll cases such as effective offset `0` or fully clamped-short content
- After reconciliation, clear bootstrap-only assumptions and continue from native scroll truth.

### 3. Remove Follow-up Bootstrap `scrollTo` Replays

- Eliminate the layout-driven initial replay path that currently runs immediate plus next-frame bootstrap scroll attempts.
- Keep imperative `scrollTo*` behavior unchanged for non-bootstrap calls.
- Keep any clamp handling that is still needed for imperative scrolls separate from bootstrap reconciliation.

### 4. Reconcile Deferred Geometry on First Native Scroll

- When bootstrap is active and the first real `onScroll` arrives:
  - compare actual native scroll against the logical bootstrap target
  - convert the delta into deferred-position rebase/update work
  - recalculate visible items from the reconciled scroll state
- Ensure this path handles:
  - under-scroll
  - over-scroll / clamp at content end
  - short-content cases

### 5. Redefine Initial Render Readiness

- `readyToRender` should flip after:
  - containers have laid out
  - bootstrap has reconciled or deterministically finished without needing a scroll event
- Do not gate visibility on a native `scrollTo` completing.
- Add a deadlock-safe fallback so missing `onScroll` does not leave the list blank forever.

### 6. Tighten Tests Around Bootstrap Semantics

- Add regression coverage for:
  - last-item initial index on Android with no follow-up bootstrap `scrollTo`
  - clamp reconciliation from an initial `contentOffset`
  - no-event completion path when offset is effectively zero or content cannot scroll
  - `readyToRender` staying false until reconciliation, then turning true once
- Preserve existing imperative scroll behavior tests.

### 7. Verify with Repeated Example Runs

- Re-run `example/app/initial-scroll-start-at-the-end` multiple times per code change.
- Inspect logs for:
  - no bootstrap `scrollTo` commands after mount
  - initial logical target
  - first real `onScroll`
  - reconciliation delta
  - `readyToRender` transition
- Stop only when repeated Android launches show:
  - no underscroll-then-correct behavior
  - no blank mounts
  - no delayed reveal caused by async settle loops

## Decisions

### Deterministic No-Event Completion

Only treat bootstrap as complete without a real `onScroll` in narrow cases:

- the resolved initial target is effectively `0`
- the resolved target clamps to `0` after layout/content size are known
- content cannot scroll, and bootstrap reaches a stable reconciled state without native divergence

Do not use "timeout with no `onScroll`" as the normal success condition.
Timeout remains only a safety net.

### Deferred Primitive Reuse

Reuse the existing bootstrap/deferred machinery as the default approach:

- keep `initialBootstrap`
- keep `desiredOffset`, `stableFrames`, and `deferredPositionDelta`
- keep queued bootstrap recalculation for no-event readiness opening
- keep logical bootstrap rendering in item/window calculation

The new work should remove bootstrap's dependence on follow-up native `scrollTo` calls, not replace the bootstrap state machine wholesale.
If a new helper is needed, it should be a thin reconciliation helper for the first native scroll, not a second bootstrap system.

### MVCP and Sticky Header Scope

MVCP must remain explicitly gated while bootstrap owns the initial anchor.
Bootstrap continues to own initial reconciliation before MVCP resumes normal adjustment behavior.

Sticky-header lists should be out of scope for the first rollout of this change.
The initial content-offset-only bootstrap path should first land for non-sticky lists, then be extended later if needed.
