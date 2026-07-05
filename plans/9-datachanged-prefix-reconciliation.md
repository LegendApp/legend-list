## Plan

After the layout-engine refactor in `plans/8-layout-engine.md`, make non-first `dataChanged` use prefix/Fenwick layout on compatible lists instead of falling back to the full `positions[]` layout pass.

The first version should not require operation-aware data changes. It should do a correctness-first full identity and known-size reconciliation pass over the new data, then keep layout offsets lazy through the prefix engine. Operation-aware append/prepend/insert/remove APIs can later reduce or skip the identity pass.

## Goals

- Preserve correctness for arbitrary keyed data changes.
- Rebuild `idCache` and `indexByKey` for the new data when needed.
- Seed the prefix engine from existing saved size knowledge so `totalSize` remains as accurate as the current cache allows.
- Avoid full `positions[]` rebuilding and downstream offset propagation.
- Let MVCP resolve old anchors against new indexes and prefix offsets.
- Keep size updates after data changes on the Fenwick path.
- Leave operation-aware data mutations for a later version.

## Non-Goals

- Do not add append/prepend/insert/remove imperative APIs in this plan.
- Do not optimize away the full identity scan for arbitrary data changes.
- Do not preserve measurements for lists without a reliable `keyExtractor`.
- Do not make multi-column or `overrideItemLayout` prefix-compatible.

## Current Behavior

For non-first keyed `dataChanged` today:

- `resetLayoutCachesForDataChange` clears `indexByKey`, `idCache`, `positions`, columns/spans, and prefix measurements.
- `sizes`, `sizesKnown`, and `averageSizes` are usually preserved by key.
- `calculateItemsInView` disables prefix materialization because `dataChanged && !state.isFirst`.
- `updateItemPositions(... dataChanged: true)` walks all items from index `0`, rebuilds `indexByKey`, writes dense `positions[]`, and recomputes `totalSize`.

The planned behavior keeps the identity/known-size reconciliation but removes the dense position rebuild.

## Reconciliation Model

For prefix-compatible keyed data changes:

1. Snapshot MVCP anchors before caches are reset. The current `prepareMVCP` already captures old visible anchor offsets; make any needed required-anchor keys explicit.
2. Reset prefix layout state without switching to the array engine:
   - clear previous dense position state through the array engine only if the selected engine is array-backed
   - clear prefix engine measurements
   - reset prefix estimate-flush state
3. Rebuild identity over the new data:
   - compute key for each index
   - rebuild `idCache[index]`
   - rebuild `indexByKey.set(key, index)`
   - keep dev duplicate-key checks
4. Rebuild prefix size knowledge:
   - if `sizesKnown.get(key)` exists, seed the prefix engine as known/measured at that index
   - otherwise if `getFixedItemSize` returns a size, seed it as known/fixed at that index
   - otherwise if `sizes.get(key)` exists, seed it as a cached committed size if the engine supports cached-but-not-measured sizes
   - otherwise leave the row estimated
5. Sync `totalSize` from the prefix engine aggregate.
6. Recompute the visible/buffered range through `layoutEngine.findIndexAtOffset`.
7. Update mounted containers from `layoutEngine.getOffset` and `layoutEngine.getSize`.
8. Run MVCP completion against rebuilt `indexByKey` and prefix offsets.

## Size Semantics

The prefix engine should distinguish:

- known/measured size: real layout measurement or fixed size; contributes to measured average when appropriate
- cached committed size: previous `sizes` value useful for stable total size, but not necessarily a real measurement for average updates
- estimated size: fallback for unknown rows

If cached committed sizes cannot be represented safely in the first implementation, seed only `sizesKnown` and fixed sizes, and document/measure the resulting `totalSize` estimate behavior before enabling broader cases.

## Fallback Rules

Use the legacy array engine for data changes when:

- there is no reliable `keyExtractor`
- the selected layout mode is multi-column or uses `overrideItemLayout`
- duplicate keys are detected
- MVCP requires an anchor that cannot be resolved in the new data
- dev validation detects that rebuilt identity does not match the data-change contract

## Operation-Aware Follow-Up

After this plan lands, a later operation-aware API can reduce the reconciliation pass:

- append/truncate can resize the prefix engine without shifting existing known indexes
- prepend can shift known indexes by count
- insert/remove can shift known indexes around the edited range
- replace can invalidate only the replaced range
- move can transform known indexes for the moved range

That later version should preserve measured sizes without scanning all data when the operation metadata is trustworthy.

## Completion Criteria

- Prefix-compatible non-first keyed `dataChanged` does not call `updateItemPositions`.
- Prefix-compatible non-first keyed `dataChanged` does not write dense `positions[]`.
- `totalSize` after data change uses preserved known/fixed size knowledge where available.
- MVCP data preservation works for visible anchors that still exist in the new data.
- Mounted containers are preserved/removed correctly based on rebuilt `indexByKey`.
- Existing no-key and incompatible layout modes keep current safe behavior.
- Full test suite, source typecheck, lint, and build pass.

## Tests

- Total size after data change:
  - all unknown sizes: total is `itemCount * currentEstimate`
  - all `sizesKnown`: exact sum survives append, prepend, remove, and reorder
  - mixed known and unknown sizes: exact known sizes plus the current estimate for unknown rows
  - preserved `sizes` without `sizesKnown`: cached committed sizes stabilize `totalSize` but do not count as measured samples for averages
  - `getFixedItemSize` for some or all rows: fixed values seed exact prefix entries
  - removed known item: removed key's size stops contributing
  - reordered known item: size follows the key, not the old index
  - inserted or prepended new item: new key contributes estimate or fixed size, not a stale neighboring size
  - estimate update after data change: unknown rows update from the new estimate without double-counting known rows
- Data append with known sizes preserves total size and avoids `updateItemPositions`.
- Data prepend with MVCP enabled preserves the visible anchor and avoids dense positions.
- Same-key same-index replacement preserves size when `itemsAreEqual` allows it.
- Removed visible anchor falls back to the next valid visible anchor or safe behavior.
- No `keyExtractor` uses the legacy reset path.
- Duplicate keys keep the existing dev warning behavior.
- `maintainScrollAtEnd` remains correct when total size changes from preserved known sizes.
- Snap offsets update from prefix offsets after a data change.
- Identity rebuild after append, prepend, remove, reorder, duplicate-key, and no-key fallback.
- Mounted containers are preserved, removed, and repositioned from rebuilt identity and engine offsets.
- Compatible prefix data changes do not call `updateItemPositions` and do not write dense `positions[]`.
- Multi-column and `overrideItemLayout` continue using the legacy array path.

## Steps

- [x] Add total-size data-change matrix tests for unknown sizes, known sizes, mixed sizes, cached committed sizes, fixed sizes, removal, reorder, insert/prepend, and estimate updates.
- [x] Add tests that characterize current keyed data-change total-size, MVCP, container preservation, and size-cache behavior.
- [x] Add prefix data-change reconciliation helpers for identity rebuild and known/fixed size seeding.
- [x] Extend the prefix engine if needed to represent cached committed sizes separately from measured sizes.
- [ ] Route compatible keyed `dataChanged` through the prefix engine after `plans/8-layout-engine.md` is complete.
- [ ] Keep no-key, multi-column, and `overrideItemLayout` data changes on the legacy array engine.
- [ ] Update MVCP data-change tests so old anchors resolve through rebuilt identity and new prefix offsets.
- [ ] Add regression tests proving compatible data changes avoid `updateItemPositions` and dense `positions[]`.
- [ ] Run focused data-change/MVCP/scroll tests, then `bun run lint:fix`, `bun run lint`, `bun run tsc`, `bun test`, and `bun run build`.
