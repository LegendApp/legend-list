## Plan

Introduce deferred positions as the general mechanism for handling item-size changes that occur before a chosen anchor item, so the list can avoid:

- rewriting positions for all visible containers when they all move by the same amount,
- repeated small MVCP-driven scroll adjustments during measurement settle,
- retry-heavy initial-scroll correction logic.

The primary feature is general deferred handling for size changes. Initial scroll should become a consumer of that same mechanism, not its own separate system.

## Primary Goal

Build one deferred-positions module that:

- tracks deferred drift caused by item-size changes before an anchor,
- provides temporary render positions for visible items without making `positions[]` non-canonical,
- knows when to flush deferred drift back into canonical positions,
- can optionally defer published content-size shrink when native clamp behavior would destabilize the anchor.

## Scope

### Included in v1

- Single-column only.
- Deferred handling for normal item-size changes before an active anchor.
- Flush boundaries for exact-offset consumers and unsafe scroll/data transitions.
- Initial-scroll integration on top of the same mechanism.
- Deferred published-size shrink only where needed for end-aligned initial scroll settling.

### Explicitly out of scope

- Multi-column support.
- Replacing prepend MVCP for data changes.
- Shadow `positions[]` arrays or per-index deferred position caches.
- Broad rework of all scroll targeting APIs.
- Extra mode/state complexity unless required by a proven edge case.

## Design Principles

- `positions[]` remains the only canonical layout model.
- Deferred state is temporary and owned by one module.
- Most of the codebase should not know deferred mode exists.
- Exact-offset consumers flush first instead of learning deferred semantics.
- If deferred positions cannot reason safely about the current state, they flush and fall back.

## Invariant

- Deferred positions may change temporary render positions, but they must not change canonical offsets until flush.

## Guardrails

- Data-change prepend remains a hard flush boundary. Do not add a `pendingPrependTransaction`-style secondary ownership layer on top of deferred positions.
- Never represent the same compensation in both canonical `positions[]` and deferred state at the same time.
- Do not use timeout-driven boundary handoff as a correctness mechanism. Timers may be used only to opportunistically flush after idle/scroll-end, not to force synthetic settle state.
- Keep deferred state minimal. If the design starts growing multiple deltas, residual error channels, or parallel pending handoff states, stop and simplify.
- Deferred positions and prepend MVCP must not overlap on the same transition. Prepend/data change owns its own compensation, then deferred positions may resume afterward.

## Ownership

Add a new core module:

- `src/core/deferredPositions.ts`

This module is the only owner of:

- active deferred session state,
- drift accumulation from size changes,
- temporary render-position reads,
- flush decisions,
- optional published-size floor used for clamp-sensitive initial-end settle.

Other modules should call into this module rather than mutating or reading deferred state directly.

## State Model

Add one small deferred-session object to `InternalState` in `src/types.base.ts`.

```ts
type DeferredPositionsState = {
    anchorKey: string;
    anchorRenderPosition: number;
    minInvalidatedIndex: number;
    drift: number;
    desiredScrollOffset?: number;
    publishedSizeFloor?: number;
};
```

Notes:

- this is the single active session shape for both general size-change handling and initial-scroll settle,
- normal size-change sessions use only the first 4 fields,
- initial-scroll sessions additionally set `desiredScrollOffset`,
- end-aligned initial sessions additionally set `publishedSizeFloor`,
- do not store a shadow `positions[]`, per-index deferred values, or a parallel initial-scroll state machine.

Related size naming:

- exact content size state should be named explicitly, for example `totalSizeExact`,
- the existing `"totalSize"` signal should remain the published content size used by `Containers`,
- do not reuse `pendingTotalSize` semantics for this design.

## Anchor Selection

Anchor selection should be explicit and deterministic.

### General deferred sessions

- Use the first fully visible item as the anchor.
- If there is no first fully visible item, do not start deferred mode.
- Once started, keep the same anchor for the life of the deferred session.
- If the anchor becomes invalid or disappears, flush rather than rebasing to a new anchor in place.

### Initial-scroll sessions

- `initialScrollIndex` uses the requested target item as the anchor.
- `initialScrollAtEnd` uses the resolved last item as the anchor.
- Initial-scroll target normalization still happens in `LegendList.tsx`; `deferredPositions.ts` receives an already-resolved anchor and optional `desiredScrollOffset`.

## Core Model

### Canonical positions

- `positions[]` stays exact and top-based.
- Deferred positions are computed only for render/windowing reads and only while a deferred session is active.

### Drift accumulation

- When an item before the anchor changes size by `diff`, update:
  - `minInvalidatedIndex = min(minInvalidatedIndex, changedIndex + 1)`
  - `drift += diff`
- The anchor item remains visually fixed at `anchorRenderPosition`.
- Positions in the invalidated region are not immediately rewritten just to move together by the same amount.

### Render positions

- Visible items in the deferred region get render positions derived from the anchor by walking backward/forward from the anchor only as needed.
- Non-visible items continue to rely on canonical `positions[]`.

### Flush

Flush means:

- write deferred drift back into canonical `positions[]`,
- clear deferred session state,
- publish exact content size if shrink had been deferred,
- optionally issue one final corrective non-animated `scrollTo` if `desiredScrollOffset` is still not satisfied.

## Total Size Model

Separate:

- exact content size, ideally stored as `totalSizeExact`, used for deferred-position/layout math,
- published content size, used by `Containers` and native clamp behavior.

Normal deferred-position sessions do not need size deferral.

Only clamp-sensitive cases, especially end-aligned initial-scroll settling, should be allowed to hold published size above exact size temporarily.

Rule for v1:

- if `publishedSizeFloor` is set, published size becomes `max(exactSize, publishedSizeFloor)`,
- otherwise published size is exact size,
- once the deferred session flushes, publish exact size again and run one final non-animated scroll if needed.

## Module API

Keep the surface small:

- `beginDeferredPositions(ctx, params)`
- `applyDeferredResizeDelta(ctx, itemKey, diff)`
- `getDeferredRenderPosition(ctx, index)`
- `flushDeferredPositions(ctx, reason)`

The important rule is:

- render/windowing code may ask for temporary render positions,
- exact-offset code must flush before reading canonical offsets.

## Main Integrations

### General deferred positions

These are the primary integration points and should be implemented first:

- `src/core/updateItemSize.ts`
- `src/core/calculateItemsInView.ts`
- `src/core/updateTotalSize.ts`
- `src/core/addTotalSize.ts`
- `src/types.base.ts`
- `__tests__/__mocks__/createMockState.ts`

### Exact-offset / flush boundaries

- `src/core/scrollToIndex.ts`
- `src/utils/updateSnapToOffsets.ts`
- any imperative exact-position readers if needed

### Later initial-scroll migration

- `src/components/LegendList.tsx`
- `src/utils/setDidLayout.ts`
- `src/core/ensureInitialAnchor.ts`
- `src/core/checkFinishedScroll.ts`
- `src/core/onScroll.ts`
- `src/utils/performInitialScroll.ts`

## Implementation Order

### 1. Build the generic deferred-session shell

- Add deferred-session state to `InternalState` and mock state.
- Add `deferredPositions.ts`.
- Split exact content size from published `"totalSize"` signal and remove reliance on `pendingTotalSize`.
- No behavior change yet.

### 2. Integrate normal size-change handling

- In `updateItemSize.ts`, when a size change happens before the active anchor, update deferred drift instead of running resize-driven MVCP for that change.
- Leave other size-change behavior alone.
- Keep this single-column only.

### 3. Use deferred render positions in windowing

- In `calculateItemsInView.ts`, use deferred render positions for visible items inside the deferred region.
- Keep canonical `positions[]` untouched until flush.
- Ensure the visible container-position writes come from render positions, not forced canonical rewrites.

### 4. Add flush boundaries

- Flush on structural data change before prepend MVCP logic runs.
- Flush before exact-offset consumers like `scrollToIndex` and snap-offset recomputation.
- Flush when user scroll moves upward into the deferred region or the anchor becomes invalid.

### 5. Add optional published-size deferral

- Introduce the exact-vs-published size split into real behavior.
- Only activate published-size deferral for clamp-sensitive sessions that explicitly request it.
- Do not let this spread into normal size-change sessions unless needed.

### 6. Migrate initial scroll onto deferred positions

- Replace the current retry/watchdog-heavy initial-scroll correction flow with:
  - one bootstrap scroll,
  - one deferred session,
  - deferred drift from subsequent size changes,
  - one final flush and optional final `scrollTo`.
- Remove redundant initial-scroll infrastructure once the new path is stable.

## Flush Boundaries

These should be centralized in `deferredPositions.ts` and treated as hard boundaries:

- structural data change,
- `scrollToIndex` / `scrollItemIntoView` / exact-offset imperative APIs,
- `snapToOffsets` recomputation,
- anchor item disappears,
- user scrolls upward such that deferred drift is no longer safe,
- deferred-session settle completion,
- explicit fallback from an unexpected state.

## Data Change Interaction

- Deferred positions should not replace prepend MVCP.
- Structural data change is a flush boundary.
- Existing prepend MVCP continues to own prepend compensation.
- After prepend MVCP settles, later size changes may create a new deferred session.
- Deferred positions should never overlap ambiguously with `pendingNativeMVCPAdjust`.
- Do not add a second prepend-specific transaction state machine inside deferred positions.

## Initial Scroll Integration

Initial scroll should be reframed as:

1. normalize an initial target in `LegendList.tsx`,
2. issue one bootstrap non-animated scroll,
3. start one deferred session using that target,
4. let deferred size-change handling preserve the anchor while measurements settle,
5. flush,
6. if needed, issue one final non-animated corrective scroll.

### `initialScrollIndex`

- Good fit for deferred positions.
- Use the requested target item as the anchor.
- Let earlier size changes accumulate drift instead of repeatedly retrying scroll.

### `initialScrollAtEnd`

- Also a good fit for deferred positions.
- The key extra behavior is deferred published-size shrink so native clamp does not fight the anchor while content above it shrinks.

### `initialScrollOffset`

- Keep on the simpler absolute-offset path for now unless migration pressure proves otherwise.
- It should not distort the generic deferred-position design.

## Code To Simplify Or Delete After Initial-Scroll Migration

- `src/utils/performInitialScroll.ts`
- `src/utils/setDidLayout.ts` initial-scroll replay logic
- `src/core/ensureInitialAnchor.ts`
- `src/core/checkFinishedScroll.ts` initial-scroll watchdog/fallback special cases
- `src/core/onScroll.ts` initial native watchdog handling
- large parts of `LegendList.tsx` target-cache / retry-window / post-finish retry flow

## Tests

Add focused tests in the same order as implementation.

### Generic deferred positions

- starts a deferred session,
- accumulates drift for size changes before the anchor,
- ignores size changes at/after the anchor,
- derives visible render positions without rewriting canonical positions,
- flushes canonical positions and clears state.

### Flush behavior

- structural data change flushes before prepend MVCP,
- prepend data change plus inserted-row measurement keeps scroll stable without any deferred prepend ownership,
- `scrollToIndex` flushes before reading canonical offsets,
- `snapToOffsets` flushes before recomputation,
- upward scroll into unsafe deferred region flushes,
- anchor disappearance flushes.

### Published size

- published size does not shrink below `publishedSizeFloor` while that floor is active,
- exact size remains current for deferred-position math,
- flush publishes exact size again.

### Initial scroll

- `initialScrollIndex` settles via the controller without repeated retry scrolls,
- `initialScrollAtEnd` survives shrinking exact total size without native clamp destabilizing the target,
- user scroll away prevents snap-back after settle.

## Verification

- Focused Jest suites for controller, item-size handling, initial scroll, MVCP interaction, and snap offsets.
- `bun run tsc:src`
- `bun run build`

If broader suite failures appear, call out any baseline noise separately.

## Stop Conditions

Stop and re-evaluate if:

- multi-column logic starts leaking into the controller design,
- exact-offset consumers begin needing deferred reads instead of flushes,
- prepend MVCP and deferred positions begin to share ownership of the same transition,
- the implementation starts introducing prepend-specific deferred transaction state,
- correctness starts depending on timeout-based settle or boundary handoff behavior,
- both canonical positions and deferred state begin carrying the same compensation,
- published-size deferral starts affecting normal size-change sessions unnecessarily,
- the deferred-positions API grows beyond a small, obvious surface.

## End State

The desired end state is:

- one generic `deferredPositions.ts` mechanism,
- one canonical `positions[]`,
- one exact content size,
- one published content size,
- initial scroll implemented as a consumer of deferred positions rather than a parallel retry/watchdog system.

## Steps

- [x] Add the generic `deferredPositions` state and exact-vs-published content-size split.
- [ ] Integrate deferred handling for normal pre-anchor item-size changes and render-position reads.
- [ ] Add centralized flush boundaries for data changes, exact-offset consumers, and unsafe scroll transitions.
- [ ] Add clamp-safe published-size deferral only for sessions that require it.
- [ ] Migrate `initialScrollIndex` / `initialScrollAtEnd` onto deferred positions and remove the old retry/watchdog infrastructure.
- [ ] Add focused tests and run targeted verification.
