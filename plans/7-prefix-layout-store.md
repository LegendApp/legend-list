## Plan

Replace eager full-list position propagation with a prefix layout store that starts as an estimated layout and progressively incorporates measured sizes. The goal is to improve first mount and size updates together, without treating `positions[]` as the canonical source of truth for every item.

## Goals

- First mount should only need total size, the initial visible range, and positions for rendered items.
- Size updates near the start of the list should not rewrite every downstream position.
- The estimate for unmeasured items can improve after initial measurements and periodic idle flushes.
- MVCP should preserve visual position across estimate flushes and measured-size updates.
- The first supported path should stay narrow: vertical, single-column, no `overrideItemLayout`, no `snapToIndices`, and no position listeners.

## Layout Store Model

- Store a mutable `estimatedSize` for unmeasured items.
- Store measured item sizes as actual sizes, not deltas from the current estimate.
- Track measured counts and measured-size sums with known prefix-sum data structures. Prefer Fenwick trees / Binary Indexed Trees for the first implementation instead of an ad hoc propagation cache.
- Maintain two prefix trees:
  - `measuredCountTree`: stores `1` for each measured index and `0` for each unmeasured index.
  - `measuredSizeTree`: stores the actual measured size for each measured index and `0` for each unmeasured index.
- Store measured sizes in a sparse map or array so remeasurement can update the trees by diff.
- Compute offsets with:

```ts
measuredCountBefore = measuredCountTree.sumBefore(index)
measuredSizeBefore = measuredSizeTree.sumBefore(index)
unmeasuredCountBefore = index - measuredCountBefore

offset = measuredSizeBefore + unmeasuredCountBefore * estimatedSize
```

- Compute total size with:

```ts
measuredCount = measuredCountTree.total()
measuredSizeTotal = measuredSizeTree.total()

totalSize = measuredSizeTotal + (dataLength - measuredCount) * estimatedSize
```

This makes first mount as cheap as `index * estimatedSize`, while allowing later estimate changes without rebasing measured rows.

## Fenwick Tree Requirements

- Use a small local numeric Fenwick tree / Binary Indexed Tree implementation, not a runtime dependency. External libraries can be reference material for API shape and tests, but this hot-path primitive should stay local, typed, and easy to audit.
- Use standard Fenwick algorithms with:

```ts
add(index, delta)
set(index, value)
sumBefore(index)
sumInclusive(index)
total()
lowerBound(prefixSum)
clear()
resize(length)
```

- Use zero-based public indexes even if the internal Fenwick array is one-based.
- Store numeric sums with `number` semantics and support fractional item sizes. Do not assume integer heights.
- `set(index, value)` should be the main measurement-facing API. It should compute the diff from the previously stored value and delegate to `add(index, delta)`.
- Avoid initializing every item with `estimatedSize`; estimates are represented by aggregate math, and only measured rows are inserted into the trees.
- For `findIndexAtOffset`, start with a binary search over `getOffset(index)` if that is simpler to validate. It is acceptable as an initial implementation even though it is `O(log n * log n)`. A Fenwick lower-bound optimization can follow once correctness is proven.
- Keep `lowerBound(prefixSum)` in the Fenwick contract even if the layout store does not use it immediately. This is a standard Fenwick capability and will be useful if offset-to-index lookup becomes hot.
- Define lookup boundary semantics explicitly:
  - `sumBefore(index)` returns the sum of entries before `index`.
  - `sumInclusive(index)` returns the sum through `index`.
  - `lowerBound(prefixSum)` returns the first index whose inclusive prefix is at least `prefixSum`.
  - `findIndexAtOffset(offset)` should return the first item whose end offset is greater than `offset`, with exact-boundary tests.
- If using a Fenwick lower-bound directly in the layout store, document the measured/unmeasured formula carefully because this is not a plain tree over every item size.

## Core API

- Add a layout-store abstraction with methods equivalent to:

```ts
getSize(index)
getOffset(index)
getTotalSize()
findIndexAtOffset(offset)
materializeRange(startIndex, endIndex)
setMeasuredSize(index, key, size)
flushEstimatedSize(newEstimatedSize, anchor)
```

- Keep `positions[]` temporarily as a materialized-window compatibility cache if needed, but stop treating it as canonical for supported layout-store paths.

## Characterization Test Adapter

- Before changing production layout representation, add a small test-only layout reader abstraction that describes the semantics the current implementation must preserve:

```ts
interface LayoutReader {
    getSize(index: number): number | undefined
    getOffset(index: number): number | undefined
    getEnd(index: number): number | undefined
    getTotalSize(): number
    findIndexAtOffset(offset: number): number | undefined
}
```

- The first adapter should read from the existing `positions[]`, size cache, and total-size logic.
- Characterization tests may seed `positions[]` for the current implementation, but assertions should go through the layout reader.
- Do not assert that downstream `positions[]` entries exist or that every item was rewritten unless the test is explicitly documenting old implementation behavior.
- Reuse the same test cases against the new prefix layout store once it exists. The Fenwick implementation should match the semantic reader contract before production callers are migrated.
- After parity is proven, migrate production reads from direct `state.positions[index]` access to layout-store accessors in narrow slices.

## First Mount

- Initialize `estimatedSize` from `estimatedItemSize`, fixed-size hints, or the current default fallback.
- Set initial total size from aggregate math, not by calculating the last item position.
- Resolve the initial rendered range from `findIndexAtOffset`.
- Materialize only the visible and buffered range.
- Support initial top and initial bottom/index cases through the same accessor model.

## Estimate Flushes

- After the initial rendered window measures, compute a better average and flush it if the change is meaningful.
- Periodically flush later averages only during calm windows:
  - no fast scroll or momentum
  - no active `scrollToIndex`
  - no initial-scroll settling
  - no replacement-measurement drain in progress
  - enough new measurements since the last flush
  - average changed by enough to matter
- Use MVCP-style correction around each flush:

```ts
oldAnchorTop = committedAnchor.top
flushEstimatedSize(newAverage)
newAnchorTop = getOffset(anchorIndex)
requestAdjust(newAnchorTop - oldAnchorTop)
```

## MVCP

- Snapshot old anchor position from the last committed rendered layout, not from a recomputed post-mutation value.
- Track committed rendered layouts by key:

```ts
committedLayoutsByKey: Map<key, { index, top, size, generation }>
```

- Use the layout store only for the new anchor offset after mutation.
- For maintain-at-end behavior, prefer the end anchor path over first-visible anchoring.

## Tests

- Add characterization tests through the test-only layout reader for current position semantics:
  - offset lookup
  - item end lookup
  - total size
  - offset-to-index lookup
  - exact offset boundaries
  - mixed estimated and measured sizes
  - size changes at index 0 and middle indexes
  - fractional sizes
  - MVCP-style anchor delta calculation
- Add pure Fenwick tree tests for:
  - prefix sums
  - total
  - repeated updates by diff
  - resizing or clearing
  - lower-bound behavior if implemented
- Add pure layout-store tests for:
  - initial total size
  - offset lookup
  - offset-to-index lookup
  - size update at index 0
  - estimate flush with mixed measured and unmeasured rows
  - total size after estimate changes
- Add integration tests for:
  - first mount at top
  - first mount at bottom or initial index
  - MVCP after an estimate flush
  - index-0 resize without full downstream position rewrite
  - scroll target offsets using measured sizes before the target

## Steps

- [x] Add the test-only layout reader adapter and characterization tests for current position semantics.
- [x] Add the internal prefix layout store and focused unit tests, reusing the characterization cases for parity.
- [x] Wire the store into the narrow supported single-column path behind a feature gate or capability check.
- [x] Replace first-mount full position building with lazy range materialization for the supported path.
- [ ] Route item measurements through `setMeasuredSize` and update total size from aggregate layout-store state.
- [ ] Add initial-window estimate flush with MVCP correction.
- [ ] Add periodic idle estimate flushes with scroll and initial-scroll guardrails.
- [ ] Migrate hot-path position reads to layout-store accessors for the supported path.
- [ ] Add integration tests for first mount, bottom/index initial scroll, MVCP, and top-of-list size updates.
- [ ] Evaluate whether the existing `estimatedLayout` branch should be replaced by, folded into, or kept separate from the new store.
