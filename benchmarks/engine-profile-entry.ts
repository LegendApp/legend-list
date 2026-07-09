import { PrefixLayoutStore } from "../src/core/PrefixLayoutStore";
import { RowLayoutStore } from "../src/core/RowLayoutStore";

type ProfileSample = {
    durationMs: number;
    heapDeltaBytes?: number;
    length: number;
    name: string;
    work: number;
};

const samples: ProfileSample[] = [];
const globalRuntime = globalThis as typeof globalThis & {
    console?: { log: (value: string) => void };
    gc?: () => void;
    performance?: { now: () => number };
    print?: (value: string) => void;
    process?: { memoryUsage?: () => { heapUsed: number } };
};

function getHeapUsed() {
    return globalRuntime.process?.memoryUsage?.().heapUsed;
}

function measure(name: string, length: number, work: number, callback: () => void) {
    globalRuntime.gc?.();
    const heapBefore = getHeapUsed();
    const start = globalRuntime.performance?.now() ?? Date.now();
    callback();
    const durationMs = (globalRuntime.performance?.now() ?? Date.now()) - start;
    const heapAfter = getHeapUsed();
    samples.push({
        durationMs,
        heapDeltaBytes: heapBefore === undefined || heapAfter === undefined ? undefined : heapAfter - heapBefore,
        length,
        name,
        work,
    });
}

function profileArrayAndSourceMutations(length: number) {
    let array = Array.from({ length }, (_, index) => index);
    measure("array-prepend-100", length, length + 100, () => {
        array = [...Array.from({ length: 100 }, (_, index) => -index - 1), ...array];
    });

    const prefix = new PrefixLayoutStore(length, 24);
    measure("data-source-prepend-100", length, 100, () => {
        prefix.splice(0, 0, 100);
    });

    measure("array-middle-insert", array.length, array.length + 1, () => {
        const middle = Math.floor(array.length / 2);
        array = [...array.slice(0, middle), -101, ...array.slice(middle)];
    });
    measure("data-source-middle-insert", prefix.length, 1, () => {
        prefix.splice(Math.floor(prefix.length / 2), 0, 1);
    });

    measure("array-single-update", array.length, array.length, () => {
        const next = array.slice();
        next[Math.floor(next.length / 2)] = -102;
        array = next;
    });
    measure("data-source-single-layout-invalidation", prefix.length, 1, () => {
        prefix.invalidateRange(Math.floor(prefix.length / 2), 1);
    });
}

function profileAccumulatedMeasurements() {
    const length = 1_000_000;
    const store = new PrefixLayoutStore(length, 24);
    let previousCount = 0;
    for (const count of [10_000, 100_000, 1_000_000]) {
        measure(`measure-through-${count}`, length, count - previousCount, () => {
            for (let index = previousCount; index < count; index++) {
                store.setMeasuredSize(index, 18 + (index % 11));
            }
        });
        previousCount = count;
    }
}

function profileRandomJumps() {
    const length = 1_000_000;
    const store = new PrefixLayoutStore(length, 24);
    let seed = 123456789;
    let checksum = 0;
    measure("random-jump-materialization", length, 40_000, () => {
        for (let jump = 0; jump < 1_000; jump++) {
            seed = (seed * 1664525 + 1013904223) >>> 0;
            const start = seed % (length - 40);
            for (let index = start; index < start + 40; index++) {
                store.setMeasuredSize(index, 18 + (index % 11));
            }
            const range = store.findIndexRangeAtOffsets(store.getOffset(start), store.getOffset(start + 39));
            checksum += (range?.end ?? 0) - (range?.start ?? 0);
        }
    });
    if (checksum === 0) {
        throw new Error("random jump checksum was not populated");
    }
}

function profileGridMutations() {
    const store = new RowLayoutStore({ estimatedSize: 120, length: 1_000_000, numColumns: 4 });
    for (const index of [12, 250_000, 500_000, 999_999]) {
        store.setMeasuredSize(index, 130);
    }
    measure("regular-grid-prepend", store.length, 4, () => store.splice(0, 0, 4));
    measure("regular-grid-move", store.length, 8, () => store.move(500_004, 20, 8));

    const spanLength = 100_000;
    const spans = new Array<number | undefined>(spanLength).fill(1);
    const variable = new RowLayoutStore({ estimatedSize: 120, length: spanLength, numColumns: 4, spans });
    spans[90_000] = 4;
    measure("variable-span-tail-repack", spanLength, 10_000, () => variable.resize(spanLength, spans, 4, 90_000));
}

for (const length of [100_000, 1_000_000]) {
    profileArrayAndSourceMutations(length);
}
profileAccumulatedMeasurements();
profileRandomJumps();
profileGridMutations();

const output = globalRuntime.console?.log ?? globalRuntime.print;
output?.(
    `LEGEND_PROFILE_JSON=${JSON.stringify({
        samples,
        version: 1,
    })}`,
);
