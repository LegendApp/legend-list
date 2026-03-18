## Plan

Replace the current retry-based initial scroll flow with a deferred-position bootstrap that performs one initial native placement, then keeps the target item fixed by accumulating layout drift into `deferredPositionDelta` instead of issuing followup native scrolls.

## V1 Scope

- Vertical, single-column lists only.
- Stable keys required for anchored targets.
- Support `initialScrollIndex` and `initialScrollAtEnd`.
- Exclude sticky headers, multi-column, masonry, and horizontal lists in v1.

## Core Invariants

- The first native initial scroll is the only bootstrap-time native scroll.
- During bootstrap, the target item's requested `viewPosition` / `viewOffset` is the invariant.
- Drift caused by measurements, items above the target, footer/header/inset changes, and viewport changes is accumulated into `deferredPositionDelta`, not corrected with `scrollTo`.
- Native scroll remains the platform source of truth; bootstrap uses `effectiveScroll = state.scroll + deferredPositionDelta` for read-side calculations.
- Bootstrap completes only after the target is stable and all threshold/ready state gates can safely reopen.

## Target Ownership

- Track the bootstrap anchor by item key, with index as a hint only.
- Resolve desired target offset using the existing target math (`viewPosition`, `viewOffset`, header/footer/inset adjustments).
- Replace viewport-boundary-based deferred accumulation for bootstrap with target-based accumulation:
  - changes above the anchored target contribute to deferred drift
  - target size changes update desired offset directly
  - below-target changes should not affect the preserved target position

## Effective Scroll Adoption

- Route bootstrap-time range/visibility calculations through `effectiveScroll`, not raw `state.scroll`.
- Keep canonical absolute `positions[]` updated in content space during bootstrap.
- Ensure read-side consumers that depend on current viewport state use the same effective scroll model:
  - item range calculation
  - sticky/visible item derivation where applicable
  - threshold checks
  - any bootstrap-specific anchor validation

## Bootstrap State Machine

### Enter

- Resolve initial target and perform one native placement using the current initial-scroll target math.
- Record bootstrap state:
  - active flag
  - target key
  - target index hint
  - requested `viewPosition` / `viewOffset`
  - latest desired offset
  - stable frame count

### Active

- Disable the current retry-based initial scroll infrastructure while bootstrap is active.
- Disable JS/native MVCP corrections that would fight the locked bootstrap scroll.
- Recompute desired offset whenever relevant measurements or layout inputs change.
- Update `deferredPositionDelta` from target drift instead of issuing followup native scrolls.

### Settle

- Treat clamp saturation as a valid settled result when the requested target position is impossible.
- Consider bootstrap settled after the target offset is stable within epsilon for two clean frames.

### Finish

- Mark initial scroll finished only when bootstrap settles.
- Reopen threshold callbacks and ready-to-render / `onLoad` gating at that point.
- Exit bootstrap mode without replaying the old retry window logic.

### Cancel

- Cancel bootstrap immediately on user takeover.
- Cancel or fall back cleanly if the target key disappears or the layout mode is unsupported.

## Infrastructure To Remove Or Replace

- Remove the retry/replay initial-scroll loop and its retry window state.
- Remove old-architecture initial anchor correction and native initial-scroll watchdog logic.
- Replace bootstrap-specific uses of current initial-scroll target persistence with the new bootstrap anchor state.
- Keep the notion of "initial scroll finished" for readiness and threshold gating, but make bootstrap completion own it.

## Deferred Geometry Changes

- Allow deferred geometry during bootstrap for supported v1 layouts.
- Prevent bootstrap-time deferred state from rebasing into native scroll.
- Keep existing non-bootstrap deferred behavior unchanged where possible.
- If needed, introduce bootstrap-specific guards/helpers rather than overloading the steady-state deferred path all at once.

## MVCP And Native ScrollView Coordination

- Suppress JS MVCP anchor corrections during bootstrap.
- Suppress native `maintainVisibleContentPosition` while bootstrap is active so the platform does not issue competing corrections.
- Resume normal MVCP behavior only after bootstrap completion.

## Threshold And Ready-State Rules

- Keep `didFinishInitialScroll` as the gate for:
  - `readyToRender`
  - `onLoad`
  - `onStartReached`
  - `onEndReached`
- Ensure threshold distance calculations use effective scroll during bootstrap-related checks, then continue with normal behavior after completion.

## Blockers To Solve During Implementation

- Effective-scroll readers still using raw `state.scroll`.
- Deferred state currently rebasing into native scroll.
- Bootstrap anchor currently tied to viewport boundary logic instead of target drift.
- MVCP/native MVCP competing with bootstrap ownership.
- Clamp behavior near start/end for impossible target placements.
- Web/native parity between transform-based and per-container deferred visual adjustments.

## Tests

- Initial estimate too small / too large without followup bootstrap native scroll.
- Target item resizes after mount and remains visually pinned.
- Repeated size changes above target accumulate into deferred drift without native scroll retries.
- Footer/header/inset changes preserve target position.
- Viewport height changes preserve target position.
- Clamp-at-start / clamp-at-end settles without chasing an impossible target.
- User scroll cancels bootstrap.
- Empty-to-nonempty `initialScrollAtEnd` works under the new bootstrap flow.
- Threshold callbacks stay gated until bootstrap completion.

## Steps

- [x] Add bootstrap state and helpers for target identity, desired offset, and effective scroll.
- [x] Route bootstrap-time visibility/range logic and threshold calculations through effective scroll.
- [x] Rework deferred accumulation to preserve the initial target rather than the current viewport boundary.
- [x] Disable and remove retry-based initial scroll, old anchor correction, and native watchdog infrastructure in favor of bootstrap ownership.
- [x] Suspend MVCP/native MVCP during bootstrap and restore normal behavior after completion.
- [x] Add settle/cancel/finish logic and keep readiness/threshold gating tied to bootstrap completion.
- [x] Add regression tests covering bootstrap stability, clamp behavior, user takeover, and `initialScrollAtEnd`.
