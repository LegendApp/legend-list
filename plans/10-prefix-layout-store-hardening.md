## Plan

Harden the Fenwick-backed prefix layout path after the completed layout-engine and data-change work. The priority is to fix source-backed regression risks found in review before doing small cleanup and optimization work.

This plan intentionally keeps the supported prefix path narrow: vertical single-column lists without `overrideItemLayout`. Larger data-structure and layout-engine simplifications should stay separate.

## Baseline

Another review run reported the current branch is green before these changes:

- `bun test`: 1593 pass, 0 fail
- focused Fenwick/prefix/range/data-change tests: 236 pass, 0 fail
- `bun run lint`: pass
- `bun run tsc:src`: pass
- `bun run build`: pass
- `git diff --check main...HEAD`: clean
- `bun run tsc`: source check passed, then failed in `example` / `example-web` because optional example dependencies or config are missing in this checkout

Before editing, rerun the focused checks if the branch has moved. After each fix, run the narrow tests that cover that fix before broad validation.

## Goals

- Avoid exact prefix-store rebuilds caused only by inline callback identity changes.
- Preserve semantic rebuild triggers: data changes, `dataKey`, `dataVersion`, `estimatedItemSize`, scroll-axis gap, support-mode changes, reliable-key availability flips, and explicit cache clears.
- Keep measured rows measured even when a real measurement is equal or nearly equal to the current estimate.
- Ensure sub-threshold prefix measurements return `0` while still promoting measurement state and allowing estimate flushes.
- Seed new prefix stores from existing `sizesKnown` whenever possible.
- Use measured-size knowledge when computing prefix seed estimates.
- Prevent production crashes from stale indexes by guarding or clamping call sites before they call strict `PrefixLayoutStore` methods.
- Keep `PrefixLayoutStore` and `FenwickTree` invariant checks strict.
- Apply small, safe hot-path cleanups after the behavior fixes.

## Non-Goals

- Do not broaden prefix support to horizontal, multi-column, or `overrideItemLayout` lists.
- Do not replace full data-change reconciliation with operation-aware append/prepend/insert/remove diffs.
- Do not fold the two-tree prefix-store consolidation into this plan.
- Do not redesign `ArrayLayoutEngine` as plain functions in this plan.
- Do not remove the layout-engine abstraction in this plan.

## Behavior Fixes

### Callback Identity Rebuilds

Inline `keyExtractor`, `getItemType`, and `getFixedItemSize` props are common. A new function identity on rerender should not by itself mean the entire prefix store must be rebuilt.

Keep exact rebuilds for semantic inputs only:

- prefix support becomes enabled or disabled
- `estimatedItemSize` changes
- scroll-axis gap changes
- reliable-key availability changes
- explicit data-change paths choose exact rebuild or reconciliation

Do not exact-rebuild only because `previous.keyExtractor !== next.keyExtractor`, `previous.getItemType !== next.getItemType`, or `previous.getFixedItemSize !== next.getFixedItemSize` when no semantic data or sizing input changed.

### Seed Estimate Semantics

Both exact rebuild and data-change reconciliation currently seed entries from `sizesKnown` but compute the seed estimate from fixed or fallback sizes. That can snap unmeasured offsets back to the prop estimate.

Use measured-average-wins semantics:

- collect measured total and measured count from `sizesKnown`
- if enough measured rows exist, use `measuredTotal / measuredCount` as the prefix store estimate
- otherwise use the fixed/fallback seed estimate
- align the "enough measured rows" threshold with the existing initial estimate flush threshold unless tests prove a different threshold is needed

Apply this in both `getPrefixLayoutStoreSeed` and `reconcilePrefixDataChange`.

### Sub-Threshold Measurements

When the prefix store accepts a real measurement, `updateOneItemSize` still needs to record that row as measured even if the numeric size change is below the normal threshold.

The return value should remain threshold-based:

- return `size - prevSize` only when `didSizeChange` is true
- return `0` for sub-threshold changes
- still call the prefix measurement path and estimate flush path when the store accepts the measurement

### New Store Seeding

When `syncPrefixLayoutStoreStructure` creates a new `PrefixLayoutStore`, seed it from `sizesKnown` whenever `sizesKnown.size > 0`.

Do this in the create branch itself rather than tracking why the previous store disappeared. First mount remains cheap because `sizesKnown` is empty.

### Stale Index Guards

Keep strict store asserts, but guard production call sites that can receive stale indexes during data-change and layout-effect timing windows.

At minimum:

- clamp estimate-flush anchor indexes to the active store length before calling `store.getOffset`
- guard `updateOneItemSize` before direct `layoutStore.getSize(index)` reads when `indexByKey` may still contain an index outside the resized store
- preserve existing engine-level `isValidIndex` behavior

Duplicate-key reconcile can remain a fallback path. The existing array fallback still emits the DEV duplicate-key warning; adding a prefix-reconcile-specific warning is optional polish, not required for this plan.

## Cleanup And Optimization

After the behavior fixes are covered by tests:

- Early-return from prefix pinned-index reconciliation when there are no always-render indices, no scroll-target pinned range, and no sticky indices to reconcile.
- Make `reconcileLayoutEngineRange` use prefix materialization instead of calling `getOffset` and `getSize` separately per index.
- Reduce layout-engine allocation churn in hot accessor paths by threading a pass-local engine through helpers where practical.
- Optimize `PrefixLayoutStore.resize` by copying typed arrays and rebuilding trees once.
- Remove the `rebuildSizes` normalized-entry clone and validate/apply entries in one pass.
- Either use `FenwickTree.lowerBound` in `PrefixLayoutStore.findIndexAtOffset` if it fits cleanly, or delete unused Fenwick methods and their tests.
- Deduplicate prefix total-size, snap-offset, and position-listener sync helpers where it reduces review friction without changing behavior.

## Deferred Refactors

These are useful, but should be separate reviewable plans:

- Consolidate the prefix store to two trees plus per-index priority flags and measured counters.
- Drop stored key arrays from `PrefixLayoutStore` if they remain unused.
- Remove duplicate values storage from `FenwickTree` if the store owns previous values.
- Replace full data-change reconciliation with operation-aware range or diff updates.
- Reconsider whether `ArrayLayoutEngine` needs to remain a class.
- Collapse broader `layoutAccessors` and engine indirection after the prefix and array ownership boundaries are stable.

## Tests

Add failing tests before each behavior fix:

- Inline `keyExtractor` rerenders do not trigger exact prefix rebuilds or full data scans when data and semantic layout inputs are unchanged.
- Inline `getItemType` rerenders do not trigger exact prefix rebuilds when data and semantic layout inputs are unchanged.
- Inline `getFixedItemSize` rerenders do not trigger exact prefix rebuilds when data and semantic layout inputs are unchanged.
- Exact rebuild seed estimates use measured averages from `sizesKnown` when enough measured rows exist.
- Data-change reconciliation seed estimates use measured averages from `sizesKnown` when enough measured rows exist.
- Prefix-mode sub-threshold measurements return `0` while still recording the row as measured.
- A newly created prefix store seeds known measurements from `sizesKnown`.
- Estimate flush clamps stale anchors and does not throw after data shrinks.
- `updateOneItemSize` does not throw when `indexByKey` contains a stale index outside the active prefix store length.

Add focused cleanup tests where behavior could drift:

- Pinned-index reconciliation skips work when all pinned sources are empty.
- Prefix range reconciliation materializes the same `sizes`, `indexByKey`, and position-listener outputs as before.
- `PrefixLayoutStore.resize` preserves cached and measured sizes across grow and shrink.
- `rebuildSizes` preserves measured-over-cached priority without cloning entries.
- `findIndexAtOffset` boundary behavior remains unchanged if `lowerBound` is used.

## Steps

- [x] Rerun the baseline focused prefix tests if the branch has moved.
- [x] Add failing tests for callback identity rerenders and measured-average seed estimates.
- [x] Remove callback identity terms from exact rebuild decisions while preserving semantic rebuild triggers.
- [ ] Implement measured-average-wins seed estimates in exact rebuild and data-change reconciliation.
- [ ] Run focused prefix lifecycle, component props, and data-change reconciliation tests.
- [ ] Add failing tests for sub-threshold prefix measurements.
- [ ] Update `updateOneItemSize` so accepted prefix measurements can promote/flush while sub-threshold changes return `0`.
- [ ] Run focused item-size and prefix lifecycle tests.
- [ ] Add failing tests for new-store seeding and stale-index crash guards.
- [ ] Seed new prefix stores from `sizesKnown` and guard stale anchor/index call sites.
- [ ] Run focused data-change, prefix lifecycle, and item-size tests.
- [ ] Apply safe cleanup and optimization changes with focused tests for each changed behavior.
- [ ] Run `bun run lint:fix` if safe for the current worktree, then `bun run lint`.
- [ ] Run `bun run tsc:src`.
- [ ] Run `bun test`.
- [ ] Run `bun run build`.
- [ ] Run `git diff --check main...HEAD`.
- [ ] If `bun run tsc` is requested or needed, report separately whether failures are limited to optional example dependencies/config.
