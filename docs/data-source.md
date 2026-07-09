# Mutation-aware data sources

Use `dataSource` when the owning model already has indexed access and knows its edits precisely. This is especially useful for editors, databases, paged timelines, piece tables, ropes, and other collections where building a new full array would dominate update time.

Existing `data` arrays remain supported. Choose one mode per list:

```tsx
<LegendList data={items} renderItem={renderItem} />

// or

<LegendList dataSource={source} renderItem={renderItem} />
```

`data` and `dataSource` are mutually exclusive in the public TypeScript interface.

## Interface

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

The source owns content and ordering. Legend List owns measured layout, virtualization, recycling, viewability, and scroll anchoring.

## Consistency and ordering

Each notification is an atomic commit:

- Apply the edit to the source before notifying listeners. All reads during the listener must see the final source state.
- Increment revisions monotonically. `previousRevision` must equal the last revision observed by the list, and `revision` must equal the source's current `getRevision()` result.
- Set `previousLength` to the length before the batch and `length` to the final length.
- Apply operations in array order. Each operation's indexes refer to the sequence produced by the preceding operation.
- Keep keys unique and stable for retained items. A move changes an item's index, not its key.
- For `move`, `to` is the destination in the sequence after removing the moved range.
- Keep the source object stable. Replacing it represents a different source lifecycle and performs safe reconciliation.
- Return the unsubscribe function from `subscribe` and release listener resources there.

Invalid ranges, revision gaps, contradictory lengths, explicit `reset` operations, or changed materialized keys take the safe reset path. That path favors correctness and may discard cached layout; do not use it as the normal edit mechanism.

## Operation semantics

### Splice

```ts
{ type: "splice", index: 20, deleteCount: 3, insertCount: 5 }
```

Removes three logical items at index 20 and inserts five new logical items there. Retained keys, measurements, mounted containers, and anchors after the edit move to their new indexes. Inserted items begin with estimated layout unless exact size information is materialized later.

### Move

```ts
{ type: "move", from: 10, to: 40, count: 4 }
```

Removes four items starting at 10, then inserts them at index 40 in the post-removal sequence. Their stable keys and known measurements move with them.

### Update

```ts
{ type: "update", index: 10, count: 1, layout: "preserve" }
{ type: "update", index: 11, count: 1, layout: "invalidate" }
```

Both variants rerender affected mounted items.

- `preserve` retains known geometry. Use it when content changes without changing the scroll-axis size.
- `invalidate` discards known geometry for the range and remeasures relevant mounted items. Use it when height or width may change.

### Reset

```ts
{ type: "reset" }
```

Requests full safe reconciliation. Use it only when precise operations are unavailable or a source invariant has been invalidated.

## Sparse and unloaded items

`getLength()` is the logical length, including unloaded items. `getKey(index)` must still return a stable unique key without loading the item. `getItem(index)` may return `undefined`.

The data-source render callback exposes that state:

```tsx
<LegendList
    dataSource={source}
    estimatedItemSize={32}
    renderItem={({ item, index }) =>
        item === undefined ? <LoadingRow index={index} /> : <DocumentRow item={item} />
    }
/>
```

Unloaded rows participate in estimated layout. Item-dependent callbacks such as fixed-size, type, and span lookup are not invoked until an item is available; unloaded variable-span grid items use span 1. When loading an item can change geometry, emit an `update` with `layout: "invalidate"`.

Unknown variable-height rows cannot have exact positions without more information. Distant jumps use aggregate estimated layout, materialize the target window first, and correct as measurements arrive.

## Minimal source example

```ts
import type {
    DataSourceMutationBatch,
    LegendListDataSource,
} from "@legendapp/list/react-native";

class MessageSource implements LegendListDataSource<Message> {
    private items: Message[] = [];
    private listeners = new Set<(batch: DataSourceMutationBatch) => void>();
    private revision = 0;

    getLength() {
        return this.items.length;
    }

    getItem(index: number) {
        return this.items[index];
    }

    getKey(index: number) {
        return this.items[index]!.id;
    }

    getRevision() {
        return this.revision;
    }

    subscribe(listener: (batch: DataSourceMutationBatch) => void) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    prepend(older: Message[]) {
        const previousLength = this.items.length;
        const previousRevision = this.revision;
        this.items.unshift(...older);
        this.revision++;
        const batch: DataSourceMutationBatch = {
            previousRevision,
            revision: this.revision,
            previousLength,
            length: this.items.length,
            operations: [
                { type: "splice", index: 0, deleteCount: 0, insertCount: older.length },
            ],
        };
        for (const listener of this.listeners) {
            listener(batch);
        }
    }
}
```

The array inside this small example is appropriate for a bounded chat. A million-line editor should keep its existing rope, piece table, tree, database cursor, or other indexed model and implement the same five reads/notifications without flattening that model into an array.

## Migrating from array mode

Array mode:

```tsx
const [items, setItems] = useState(initialItems);

setItems((current) => [...inserted, ...current]);

<LegendList
    data={items}
    keyExtractor={(item) => item.id}
    renderItem={({ item }) => <Row item={item} />}
/>
```

Data-source mode:

```tsx
source.prepend(inserted);

<LegendList
    dataSource={source}
    renderItem={({ item }) => item && <Row item={item} />}
/>
```

Identity comes from `source.getKey`, so `keyExtractor` is unnecessary. Emit updates explicitly, so `itemsAreEqual` and `dataVersion` are unnecessary. `dataKey` and `dataVersion` remain coarse array-mode invalidation controls; changing them with a data source triggers reconciliation instead of the precise mutation path.

## Performance characteristics

- Initial mount reads the logical length and only the items and keys needed for visible/buffered or explicitly requested state.
- Single-column layout stores unknown ranges as aggregate runs and known measurements in packed blocks.
- Exact splice, move, and invalidation work is proportional to sparse tree depth, affected packed blocks, and already materialized state rather than logical length.
- Regular multi-column layout derives rows and columns mathematically and keeps known measurements sparse.
- Variable spans require explicit topology because one span can change all following row groupings. Same-length updates repack from the affected row; structural changes may require rebuilding the affected dense topology.
- Fully materializing all one million measurements remains linear by definition. Sparse jumps and ordinary edits do not perform that pass.
- Changing estimates updates unknown aggregate contribution without rewriting known rows.

See [the V8 and Hermes profile](../benchmarks/engine-profile.md) for the reproducible benchmark, recorded mutation timings, heap behavior, and the explicit cost of materializing every row.

## Compatibility checklist

- Keep `estimatedItemSize`, recycling, MVCP, end-following, viewability, sticky items, snap offsets, and imperative scrolling configured as usual.
- Use `extraData` for render dependencies outside source items, just as in array mode.
- Use exact mutation batches instead of `dataVersion` for source edits.
- Keep a stable source instance for its lifetime.
- Do not enumerate all keys merely to satisfy the list. `getKey` is called only for indexes Legend List needs to identify.
- Test prepend/remove anchoring, append-at-end behavior, distant jumps, recycled row state, and any variable-span grid mutations in the target application before rollout.
