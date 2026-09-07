import { applyDataSourceMutationBatches } from "../src/core/DataSourceMutationCoordinator";
import { PrefixLayoutStore } from "../src/core/PrefixLayoutStore";
import { RowLayoutStore } from "../src/core/RowLayoutStore";

function median(values: number[]) {
    return values.sort((a, b) => a - b)[Math.floor(values.length / 2)];
}
const length = 1_000_000;
for (const knownCount of [1000, 10000, 100000]) {
    let keyReads = 0;
    const source = {
        getItem: (i: number) => i,
        getKey: (i: number) => {
            keyReads++;
            return `k${i}`;
        },
        getLength: () => length,
    };
    const state: any = {
        containerItemKeys: new Map(),
        containerItemMetadata: new Map(),
        endBuffered: 39,
        endNoBuffer: 39,
        idCache: [],
        idsInView: [],
        indexByKey: new Map(),
        layoutStoreRuntime: { store: new PrefixLayoutStore(length, 20) },
        props: { numColumns: 1 },
        sizes: new Map(),
        sizesKnown: new Map(),
        startBuffered: 0,
        startNoBuffer: 0,
    };
    const ctx: any = {
        mapViewabilityAmountValues: new Map(),
        mapViewabilityConfigStates: new Map(),
        state,
        values: new Map([["activeStickyIndex", -1]]),
    };
    for (let i = 0; i < knownCount; i++) {
        state.idCache[i] = `k${i}`;
        state.indexByKey.set(`k${i}`, i);
    }
    for (const count of [1, 10]) {
        const batch = {
            length,
            operations: Array.from({ length: count }, (_, i) => ({
                count: 1,
                index: i,
                layout: "preserve" as const,
                type: "update" as const,
            })),
            previousLength: length,
            previousRevision: 0,
            revision: 1,
        };
        const times = [];
        for (let r = 0; r < 12; r++) {
            keyReads = 0;
            const t = performance.now();
            const result = applyDataSourceMutationBatches(ctx, source as any, [batch]);
            if (!result.applied) throw Error("not applied");
            if (r >= 2) times.push(performance.now() - t);
        }
        console.log(
            JSON.stringify({
                case: "coordinator-preserve",
                keyReads,
                knownCount,
                medianMs: median(times),
                operations: count,
            }),
        );
    }
    const row = new RowLayoutStore({ estimatedSize: 20, length, numColumns: 4 });
    for (let i = 0; i < knownCount; i++) row.setMeasuredSize(i, 30);
    const times = [];
    for (let r = 0; r < 12; r++) {
        row.setMeasuredSize(0, 30);
        const t = performance.now();
        row.invalidateRange(0, 1);
        if (r >= 2) times.push(performance.now() - t);
    }
    console.log(JSON.stringify({ case: "grid-single-invalidation", knownCount, medianMs: median(times) }));
}

const prefix = new PrefixLayoutStore(length, 20);
for (let i = 0; i < 100000; i++) prefix.setMeasuredSize(i * 7, 30);
let checksum = 0;
for (const kind of ["point-reads", "range-reads"]) {
    const times = [];
    for (let r = 0; r < 12; r++) {
        const t = performance.now();
        if (kind === "point-reads") for (let i = 0; i < 100000; i++) checksum += prefix.getSize((i * 97) % length);
        else
            for (let i = 0; i < 1000; i++) {
                const start = (i * 997) % (length - 100);
                prefix.forEachLayout(start, start + 99, (_index, _offset, size) => {
                    checksum += size;
                });
            }
        if (r >= 2) times.push(performance.now() - t);
    }
    console.log(JSON.stringify({ case: kind, checksum, medianMs: median(times), reads: 100000 }));
}
