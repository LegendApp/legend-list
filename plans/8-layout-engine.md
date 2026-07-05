## Plan

Move prefix-compatible layout onto a real layout-engine abstraction so the prefix/Fenwick path no longer writes or depends on `positions[]`. Keep the existing array/`positions[]` layout only as a legacy engine for unsupported modes until those modes get their own engine support.

This should happen before the `dataChanged` work in `plans/9-datachanged-prefix-reconciliation.md`.

## Goals

- Make `LayoutEngine` the only production interface for offsets, sizes, ends, totals, offset-to-index lookup, measurement updates, and snap offsets.
- Make the prefix/Fenwick engine independent of `state.positions`.
- Keep `positions[]` private to the legacy array engine.
- Keep feature code agnostic to whether layout is backed by a prefix store or a dense array.
- Preserve current behavior for MVCP, scroll targets, sticky headers, snap offsets, viewability, mounted-container positioning, and total-size updates.
- Add tests proving prefix-compatible first mount and size updates leave `positions[]` empty.

## Non-Goals

- Do not solve non-first `dataChanged` prefix reconciliation in this plan.
- Do not make multi-column or `overrideItemLayout` prefix-compatible yet.
- Do not delete the legacy array engine while unsupported modes still need it.
- Do not introduce operation-aware data mutation APIs in this plan.

## Architecture

Introduce an internal layout engine boundary equivalent to:

```ts
interface LayoutEngine {
    readonly kind: "array" | "prefix"
    getOffset(index: number | undefined): number | undefined
    getSize(index: number | undefined): number | undefined
    getEnd(index: number | undefined): number | undefined
    getTotalSize(): number
    findIndexAtOffset(offset: number): number | undefined
    getSnapOffsets(indices: number[]): number[]
    recordMeasuredSize(index: number | undefined, key: string, size: number): boolean
    syncTotalSize(): boolean
}
```

Implementations:

- `PrefixLayoutEngine`: owns `PrefixLayoutStore` and uses Fenwick/prefix math for all offsets. It does not write `state.positions`.
- `ArrayLayoutEngine`: wraps the existing dense `positions[]` behavior and is the only production owner of `state.positions`.

Identity state remains separate from layout state:

- `idCache`: index-to-key cache for resolved indexes.
- `indexByKey`: sparse key-to-index cache for mounted, visible, listener, anchor, scroll-target, pinned, and materialized identity needs.
- `containerItemKeys`: key-to-container assignment.

The prefix engine should not populate `indexByKey` by writing positions. Range and container code should resolve keys as part of identity/range reconciliation, then ask the engine for offsets.

## Migration Notes

- `layoutAccessors.ts` can become the first home for the engine boundary, but avoid leaving it as a collection of prefix conditionals.
- `materializePrefixLayoutStoreRange` should stop writing `state.positions`; replace it with range/key reconciliation helpers that fill `idCache`, `indexByKey`, and size caches where needed.
- Container positioning should call `layoutEngine.getOffset(index)` and `layoutEngine.getSize(index)`.
- MVCP should snapshot previous committed offsets through the engine and compare against new engine offsets.
- Sticky, snap, scrollTo, viewability, initial-scroll, and total-size helpers should not read `state.positions` directly.
- Tests may inspect `positions[]` only to prove the prefix path does not populate it.

## Completion Criteria

- Production direct `state.positions[index]` access exists only in the array layout engine and tests that explicitly target legacy behavior.
- Prefix-compatible first mount does not call `updateItemPositions` and does not write `positions[]`.
- Prefix-compatible measured-size updates do not call `updateItemPositions` and do not write downstream `positions[]`.
- Snap offsets, sticky push limits, scroll targets, MVCP, viewability, and mounted-container positions still pass through the engine.
- Full test suite, source typecheck, lint, and build pass.

## Tests

Add these before the migration when they can characterize current behavior without the new engine boundary:

- Current layout-reader behavior for offset, size, end, total, and MVCP-style anchor delta over fixed, mixed, measured, and estimated size sequences.
- Current snap offset behavior for fixed and mixed-size rows.
- Current scroll target behavior for measured rows, unknown rows, and large offscreen indexes.
- Current viewability and sticky-header calculations against dense `positions[]`.
- Current mounted-container positioning after a measured size update.

Add these after the engine boundary exists:

- A shared `LayoutEngine` contract suite for `ArrayLayoutEngine` and `PrefixLayoutEngine` covering offset, size, end, total, offset-to-index lookup, snap offsets, and measured-size updates.
- Prefix-compatible first mount leaves `state.positions` empty.
- Prefix-compatible index-0 size updates update offsets/total through the prefix engine without writing downstream `positions[]`.
- Prefix-compatible MVCP snapshots and compares offsets through the engine while `state.positions` remains empty.
- Prefix-compatible snap offsets, scroll targets, sticky push limits, viewability, and mounted-container positions work with an empty `positions[]`.
- Multi-column and `overrideItemLayout` continue using `ArrayLayoutEngine` until they are explicitly supported by a row-aware prefix engine.

## Steps

- [x] Add pre-migration characterization tests for current layout access, snap offsets, scroll targets, viewability, sticky headers, mounted-container positioning, and MVCP anchor deltas.
- [x] Define the `LayoutEngine` interface and engine selection boundary.
- [x] Add a shared `LayoutEngine` contract suite that can run against both array and prefix implementations.
- [x] Implement `ArrayLayoutEngine` around the existing `positions[]` behavior without changing legacy semantics.
- [x] Implement `PrefixLayoutEngine` around `PrefixLayoutStore` with no `positions[]` writes.
- [x] Replace `materializePrefixLayoutStoreRange` with prefix identity/range reconciliation that fills `idCache`, sparse `indexByKey`, and size caches without writing positions.
- [x] Update `calculateItemsInView` to use `findIndexAtOffset` and `getOffset`/`getSize` from the selected engine for prefix-compatible range discovery.
- [ ] Update mounted-container sync to position containers only from engine offsets and sizes.
- [ ] Update MVCP, sticky header calculations, snap offsets, scrollTo/initial-scroll helpers, viewability, and total-size helpers to use the engine boundary.
- [ ] Move all remaining production `positions[]` reads/writes into `ArrayLayoutEngine` or delete them from the prefix path.
- [ ] Add post-migration hard-boundary tests proving prefix first mount, snap offsets, scroll targets, sticky headers, viewability, mounted-container positions, MVCP, and index-0 size updates work with an empty `positions[]`.
- [ ] Run focused layout/MVCP/scroll tests, then `bun run lint:fix`, `bun run lint`, `bun run tsc`, `bun test`, and `bun run build`.
