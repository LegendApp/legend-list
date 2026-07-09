## Plan

Make mutation-aware indexed data and sparse sequence layout the foundation of Legend List 4. Existing array consumers remain supported through an adapter, while `dataSource` consumers can edit, load, and navigate million-item collections without constructing or comparing full arrays.

This plan builds on the current store-only layout architecture. It should be developed and tested privately as one v4 effort, then released as a public `4.0.0-beta.0` after real applications have validated the interface and behavior.

## Goals

- Make ordinary work proportional to the changed, visible, buffered, or previously materialized regions rather than total logical data length.
- Eliminate before/after array construction and comparison when the owning model can emit exact mutations.
- Preserve stable identity, measurements, mounted containers, MVCP anchors, end-following state, and viewability state outside changed ranges.
- Support sparse logical collections whose length is known even when some items are not materialized.
- Keep distant jumps cheap by using estimated unknown layout and materializing the target viewport first.
- Reduce accumulated layout memory and GC pressure by packing known sizes into blocks instead of allocating one JavaScript tree object per known row.
- Keep existing `data` behavior compatible by routing arrays through the same indexed-data seam.
- Keep regular multi-column layout mathematical and retain an explicit, correct topology path for variable spans.

## Non-Goals

- Do not make unknown variable-height rows exact without source-provided layout information.
- Do not couple the list to a specific editor, state manager, database, rope, piece table, or CRDT implementation.
- Do not convert a `dataSource` back into an array internally.
- Do not route precise mutation batches through the coarse `dataVersion` reset path.
- Do not release placeholder mutation behavior that silently resets or rebuilds the full collection for operations advertised as incremental.
- Do not publish the public beta until the array and data-source adapters pass the same behavioral contract and internal applications have exercised the new path.

## Current Architecture

- Public data mode requires `ReadonlyArray<ItemT>` plus `renderItem`.
- Array reference, `dataKey`, and `dataVersion` changes initiate structural change handling.
- Structural comparison is already sparse for materialized identities, but callers still need to create, retain, or compare large arrays before Legend List receives the change.
- Data reconciliation snapshots sparse identities, clears transient caches, and tries to reseed known layout by key and a possible global index shift.
- `PrefixLayoutStore` represents unknown rows with one scalar estimate and known rows with an index-keyed treap.
- The treap is sparse in logical length but allocates one JavaScript object, child references, and subtree statistics per known row.
- `RowLayoutStore` derives regular-grid topology mathematically, stores known item sizes sparsely, and retains dense topology only for variable spans.

## Target Architecture

```text
document / collection model
        |
        | indexed reads + atomic mutation batches
        v
indexed-data seam
        |
        +--> identity, renderer, and container reconciliation
        |
        +--> sparse sequence-layout mutations
                    |
                    v
        visible/buffered range and offsets
```

The owning model applies each edit once and emits the exact mutation it already knows. Legend List reads only the requested items and transforms its sparse state directly. There is no full before/after comparison.

## Indexed-Data Seam

Introduce one deep internal module through which all core list code reads item count, items, and keys:

```ts
interface IndexedData<ItemT> {
    getLength(): number;
    getItem(index: number): ItemT | undefined;
    getKey(index: number): string;
}
```

The seam is real because it has at least two adapters:

- `ArrayDataAdapter`: preserves the existing `data`, `keyExtractor`, `itemsAreEqual`, `dataKey`, and `dataVersion` interface.
- `DataSourceAdapter`: subscribes to a stable mutable source and forwards exact mutation batches.

Core modules should not branch on `data` versus `dataSource`. They should depend on `IndexedData` and, where relevant, the mutation stream exposed by its adapter.

The public data modes should be mutually exclusive:

```ts
type LegendListDataMode<ItemT> =
    | { data: ReadonlyArray<ItemT>; dataSource?: never }
    | { data?: never; dataSource: LegendListDataSource<ItemT> };
```

## Data-Source Interface

Start with a narrow interface whose ordering and consistency rules are part of its contract:

```ts
interface LegendListDataSource<ItemT> {
    getLength(): number;
    getItem(index: number): ItemT | undefined;
    getKey(index: number): string;
    getRevision(): number;
    subscribe(listener: (batch: DataSourceMutationBatch) => void): () => void;
}

interface DataSourceMutationBatch {
    previousRevision: number;
    revision: number;
    previousLength: number;
    length: number;
    operations: DataSourceOperation[];
}

type DataSourceOperation =
    | { type: "splice"; index: number; deleteCount: number; insertCount: number }
    | { type: "move"; from: number; to: number; count: number }
    | { type: "update"; index: number; count: number; layout: "preserve" | "invalidate" }
    | { type: "reset" };
```

Contract requirements:

- A batch is atomic from the list's perspective.
- Operations are applied in listed order; each operation's indexes refer to the result of the preceding operation.
- The source exposes its final state while listeners process the batch.
- Revisions are monotonic. A missed, stale, or contradictory revision uses the explicit safe reset path.
- Keys are unique and stable across updates and moves.
- `getItem` may return `undefined` for an unloaded logical item; that index still exists and participates in estimated layout.
- `layout: "preserve"` rerenders affected mounted items without discarding their known geometry.
- `layout: "invalidate"` discards only the affected known geometry and schedules remeasurement when relevant.

## Mutation Coordinator

Centralize mutation handling in one deep module rather than spreading operation switches through render, layout, identity, MVCP, and viewability code.

For each batch, the implementation should:

1. Validate revision, lengths, operation ranges, and key invariants needed by materialized entries.
2. Snapshot visible and end anchors before indexes or layout change.
3. Apply sequence operations to the layout store.
4. Transform sparse index-to-key and key-to-index caches.
5. Preserve, move, invalidate, or release mounted containers according to stable keys and operation ranges.
6. Update sticky, snap, pinned, listener, and viewability state only where the mutation affects it.
7. Discover and materialize the visible range before prewarming the rest of the buffered range.
8. Complete MVCP or maintain-at-end correction against post-mutation offsets.
9. Publish total-size, range, threshold, and render notifications once for the completed batch.

The mutation coordinator's interface is the primary integration and test seam. Revision drift, invalid input, duplicate keys, and source replacement must have explicit error or reset behavior.

## Mutation-Aware Layout Interface

Extend the layout-store contract with structural operations:

```ts
interface MutableLayoutStore extends LayoutStore {
    splice(index: number, deleteCount: number, insertCount: number): void;
    move(from: number, to: number, count: number): void;
    invalidateRange(index: number, count: number): void;
}
```

The contract suite must verify:

- Offsets, sizes, totals, and offset-to-index lookup before and after every operation.
- Exact-boundary and fractional-size behavior.
- Known sizes move with retained sequence ranges and disappear with removed ranges.
- Inserted rows begin unknown unless exact layout information is explicitly supplied.
- Estimate changes update all unknown contribution without rebasing known sizes.
- Operations remain proportional to tree depth plus affected packed blocks, not total logical length.

## Sparse Sequence Layout

Replace the absolute-index, object-per-known-row representation with an implicit augmented piece/B+ tree once the mutation interface is characterized.

Leaves contain pieces such as:

```text
unknown run: 950000 items
known block: 128 packed sizes
unknown run: 20000 items
known block: 64 packed sizes
```

Each subtree aggregates:

- Logical item count.
- Known item count.
- Known size total.
- Measured item count.
- Measured size total.

Effective subtree size remains:

```ts
knownSizeTotal + (logicalCount - knownCount) * estimatedSize;
```

Known blocks should use compact storage such as `Float64Array` sizes and bit-packed or byte-packed size kinds. Tree metadata is stored per block or internal node rather than per item. Float64 aggregate semantics should preserve existing offset-boundary behavior.

Sequence operations split, merge, detach, and insert pieces. Because indexes derive from subtree logical counts, an insertion does not rewrite every later known index.

## Layout Modes

### Single Column

- Use the sparse sequence tree directly.
- Treat million-item mount, edit, resize, and random-jump behavior as the primary scaling target.
- Keep unknown ranges estimated and materialize the target viewport first after a large jump.

### Regular Multi-Column

- Continue deriving item row and column mathematically.
- Transform sparse known item sizes with source mutations.
- Recompute only affected materialized row blocks when an insertion changes downstream modulo grouping.
- Keep row geometry in the same sparse sequence-layout interface.

### Variable Spans

- Retain explicit packing topology because a span can change all downstream row grouping.
- Use the mutation index as the earliest invalidation boundary.
- Keep this exact fallback explicit and tested; do not claim sublinear arbitrary-span repacking without source-provided row topology or aggregates.

## Exact And Estimated Distant Layout

- Unknown variable-height rows remain estimated; this is an information constraint rather than a tree limitation.
- `scrollToIndex`, scrollbar dragging, and large jumps should navigate using aggregate estimate-backed layout and materialize only the target region.
- Exact distant positions for mixed fixed sizes require optional source-provided prefix or range layout aggregates.
- Keep that capability separate from the initial data-source interface until a concrete consumer proves its shape and consistency requirements.

## Compatibility And Ownership

- Existing array behavior remains supported and runs through `ArrayDataAdapter`.
- `dataKey` still represents replacement of the logical dataset for array consumers.
- `dataVersion` remains a coarse array-mode invalidation signal, not a data-source mutation mechanism.
- `itemsAreEqual` remains an array-adapter concern; data-source consumers communicate updates explicitly.
- Data-source identity should come from `getKey` so the list does not need to load every item merely to identify it.
- Layout ownership remains inside Legend List. A markdown rope, database, or CRDT owns item sequence and content but does not need to know rendered heights.

## Validation And Performance Gates

Add a deterministic million-item fixture and benchmark at least these cases:

- Initial mount at the start, middle, and end without full item or key traversal.
- Sequential scrolling that accumulates 10,000, 100,000, and eventually 1,000,000 known measurements.
- Random scrollbar jumps that materialize scattered viewport-sized chunks.
- Single-line content update with preserved and invalidated layout.
- Splice near the start, middle, and end.
- Batched disjoint edits.
- Move, prepend, append, truncate, and full reset.
- MVCP prepend/remove and maintain-at-end append.
- Regular-grid insertions and variable-span invalidation.

Measure separately:

- Source mutation time.
- Legend List mutation-processing time.
- Visible React rendering and native/web measurement time.
- Offset and offset-to-index query latency.
- Heap growth and GC pauses under V8 and Hermes.
- `getItem` and `getKey` call counts.
- Number of materialized identities and layout entries.

Performance acceptance should prove asymptotic behavior, not only one favorable duration. Increasing logical length from 100,000 to 1,000,000 with the same visible range and mutation should not multiply ordinary mount or mutation work. Any intentional full pass must be named, instrumented, and limited to an explicit incompatible operation such as full reset or arbitrary span-topology rebuild.

## Internal Rollout

- Exercise the data-source path in the million-item markdown editor first.
- Add at least one chat/prepend consumer and one regular-grid consumer so the interface is not overfit to a single-column editor.
- Record behavior and performance against the array path with equivalent visible content.
- Treat MVCP, recycling, initial/imperative scroll, sticky items, snap offsets, viewability, and end-following as release gates.
- Publish a public `4.0.0-beta.0` only after internal applications can use the new path without application-specific list workarounds.

## Completion Criteria

- A data-source edit reaches Legend List without producing or comparing full before/after arrays.
- Default single-column mount, targeted mutation, size update, and distant jump do not iterate the million-item logical collection.
- Mutation batches preserve unaffected identity, layout, containers, and scroll anchors.
- Array and data-source adapters pass a shared behavioral interface suite.
- The packed sparse layout implementation passes the existing `LayoutStore` contract and randomized model-based operation tests.
- Memory growth tracks materialized known layout compactly rather than logical length or JavaScript object-per-row overhead.
- Regular grids remain sparse and arithmetic; variable spans retain an explicit correct fallback.
- Focused tests, `bun run lint:fix`, `bun run lint`, `bun run tsc`, `bun test`, and `bun run build` pass.
- Internal app profiling demonstrates the intended million-item performance before the public beta is published.

## Steps

- [x] Add characterization tests and benchmark instrumentation for the current array-change, identity-reconciliation, sparse-layout, MVCP, grid, and million-item paths.
- [x] Define the public `LegendListDataSource` interface, mutation-batch semantics, and mutually exclusive public data modes with type-level contract tests.
- [x] Introduce the internal `IndexedData` seam and migrate core reads to array and data-source adapters without changing array behavior.
- [x] Implement stable data-source subscription, revision validation, source replacement, lifecycle cleanup, and explicit safe-reset behavior.
- [ ] Implement the mutation coordinator and transform sparse identity, renderer, container, viewability, sticky, snap, pinned, and listener state directly from mutation batches.
- [ ] Add structural mutation methods and a randomized model-based contract suite to `LayoutStore` and `RowLayoutStore`.
- [ ] Implement the packed implicit sparse sequence store, migrate single-column layout behind the existing layout seam, and compare its correctness, memory, GC, and latency with the current treap.
- [ ] Complete regular-grid mutation handling and the explicit variable-span invalidation/repacking path with focused performance and behavior tests.
- [ ] Add the million-item markdown fixture plus chat and grid fixtures, then profile array and data-source paths under V8 and Hermes.
- [ ] Document the public interface, mutation ordering, sparse-item behavior, compatibility rules, performance characteristics, and migration examples.
- [ ] Run internal application rollout, resolve behavioral or performance regressions, and prepare `4.0.0-beta.0` only after all completion criteria pass.
