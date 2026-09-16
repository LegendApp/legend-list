import { expect, it, mock } from "bun:test";
import "../setup";

import { applyDataSourceMutationBatches } from "../../src/core/DataSourceMutationCoordinator";
import { DataSourceAdapter } from "../../src/core/IndexedData";
import { LayoutStoreRuntime } from "../../src/core/LayoutStoreRuntime";
import { PrefixLayoutStore } from "../../src/core/PrefixLayoutStore";
import { RowLayoutStore } from "../../src/core/RowLayoutStore";
import type { DataSourceOperation, LegendListDataSource } from "../../src/types.base";
import { createMockContext } from "../__mocks__/createMockContext";

// The dense model follows item identity through array operations; it does not use
// the coordinator's index transforms or either store's mutation implementation.
for (const numColumns of [1, 3]) {
    for (const initialSeed of [83791, 22937, 67321]) {
        it(`matches dense identity and geometry after mixed source batches (${numColumns} columns, seed ${initialSeed})`, () => {
            let seed = initialSeed;
            const random = (max: number) => {
                seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
                return seed % max;
            };
            let nextId = 0;
            const createItem = () => ({ id: `item-${nextId++}`, version: 0 });
            const items = Array.from({ length: 30 }, createItem);
            const known = new Map<string, number>();
            const materialized = new Set<string>();
            const source: LegendListDataSource<(typeof items)[number]> = {
                getItem: (index) => items[index],
                getKey: mock((index: number) => {
                    expect(index).toBeGreaterThanOrEqual(0);
                    expect(index).toBeLessThan(items.length);
                    return items[index].id;
                }),
                getLength: () => items.length,
                getRevision: () => 0,
                subscribe: () => () => {},
            };
            const store =
                numColumns === 1
                    ? new PrefixLayoutStore(items.length, 25)
                    : new RowLayoutStore({ estimatedSize: 25, length: items.length, numColumns });
            const ctx = createMockContext(
                {},
                {
                    idCache: [],
                    indexByKey: new Map(),
                    layoutStoreRuntime: new LayoutStoreRuntime(store, 25),
                    props: { dataSource: source, numColumns },
                },
            );
            ctx.state.indexedData = new DataSourceAdapter(source);
            try {
                for (let step = 0; step < 200; step++) {
                    // Materialize and measure only a sparse sample, including zero sizes.
                    for (let sample = 0; sample < 3 && items.length > 0; sample++) {
                        const index = random(items.length);
                        const key = items[index].id;
                        const size = random(121);
                        materialized.add(key);
                        known.set(key, size);
                        ctx.state.idCache[index] = key;
                        ctx.state.indexByKey.set(key, index);
                        ctx.state.sizes.set(key, size);
                        ctx.state.sizesKnown.set(key, size);
                        store.setMeasuredSize(index, size);
                    }
                    const target = items.length ? items[random(items.length)].id : undefined;
                    ctx.state.scrollingTo = target
                        ? { index: items.findIndex((item) => item.id === target), offset: 0 }
                        : undefined;
                    const previousLength = items.length;
                    const operations: DataSourceOperation[] = [];
                    const materializedBefore = materialized.size;
                    for (let operationIndex = 0; operationIndex < 4; operationIndex++) {
                        const action = random(3);
                        if (action === 0 || items.length === 0) {
                            const index = random(items.length + 1);
                            const deleted = Math.min(random(4), items.length - index);
                            const inserted = items.length < 60 ? random(4) : 0;
                            for (const item of items.splice(
                                index,
                                deleted,
                                ...Array.from({ length: inserted }, createItem),
                            )) {
                                known.delete(item.id);
                                materialized.delete(item.id);
                            }
                            operations.push({ deleteCount: deleted, index, insertCount: inserted, type: "splice" });
                        } else if (action === 1) {
                            const from = random(items.length);
                            const count = 1 + random(Math.min(4, items.length - from));
                            const to = random(items.length - count + 1);
                            items.splice(to, 0, ...items.splice(from, count));
                            operations.push({ count, from, to, type: "move" });
                        } else {
                            const index = random(items.length);
                            const count = 1 + random(Math.min(4, items.length - index));
                            const invalidate = random(2) === 0;
                            for (let i = index; i < index + count; i++) {
                                items[i] = { ...items[i], version: items[i].version + 1 };
                                if (invalidate) known.delete(items[i].id);
                            }
                            operations.push({
                                count,
                                index,
                                layout: invalidate ? "invalidate" : "preserve",
                                type: "update",
                            });
                        }
                    }
                    const getKey = source.getKey as ReturnType<typeof mock>;
                    getKey.mockClear();
                    const result = applyDataSourceMutationBatches(ctx, source, [
                        {
                            length: items.length,
                            operations,
                            previousLength,
                            previousRevision: step,
                            revision: step + 1,
                        },
                    ]);
                    expect(result.applied).toBe(true);
                    expect(getKey.mock.calls.length).toBeLessThanOrEqual(materializedBefore);
                    expect(ctx.state.indexByKey).toEqual(
                        new Map(
                            items.flatMap((item, index) =>
                                materialized.has(item.id) ? [[item.id, index] as const] : [],
                            ),
                        ),
                    );
                    expect(ctx.state.sizesKnown).toEqual(known);
                    expect(ctx.state.sizes).toEqual(known);
                    for (const [key, index] of ctx.state.indexByKey) expect(ctx.state.idCache[index]).toBe(key);
                    const targetIndex = items.findIndex((item) => item.id === target);
                    if (targetIndex >= 0) expect(ctx.state.scrollingTo!.index).toBe(targetIndex);
                    let offset = 0;
                    for (let start = 0; start < items.length; start += numColumns) {
                        let height = 0;
                        for (let i = start; i < Math.min(start + numColumns, items.length); i++) {
                            const size = known.get(items[i].id) ?? 25;
                            expect(store.getOffset(i)).toBe(offset);
                            expect(store.getSize(i)).toBe(size);
                            height = Math.max(height, size);
                        }
                        offset += height;
                    }
                    expect(store.getTotalSize()).toBe(offset);
                    expect(store.getMeasuredCount()).toBe(known.size);
                    expect(store.length).toBe(items.length);
                }
            } finally {
                ctx.state.scheduledWork.dispose();
            }
        });
    }
}
