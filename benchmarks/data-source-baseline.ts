import { checkStructuralDataChange } from "../src/core/checkStructuralDataChange";
import { PrefixLayoutStore } from "../src/core/PrefixLayoutStore";
import { RowLayoutStore } from "../src/core/RowLayoutStore";
import type { InternalState } from "../src/types.internal";

interface BenchmarkOptions {
    knownCount?: number;
    lengths?: number[];
    queryCount?: number;
}

interface BenchmarkSample {
    durationMs: number;
    keyExtractorCalls?: number;
    knownCount: number;
    length: number;
    name: "array-structural-comparison" | "prefix-layout" | "regular-grid-layout";
    queryCount: number;
}

export interface DataSourceBaseline {
    generatedAt: string;
    samples: BenchmarkSample[];
    version: 1;
}

interface BenchmarkItem {
    id: string;
}

function measure(callback: () => void) {
    const start = performance.now();
    callback();
    return performance.now() - start;
}

function nextRandom(seed: number) {
    return (seed * 1664525 + 1013904223) >>> 0;
}

function getKnownIndex(index: number, knownCount: number, length: number) {
    return Math.min(length - 1, Math.floor(((index + 1) * length) / (knownCount + 1)));
}

function benchmarkArrayStructuralComparison(length: number, queryCount: number): BenchmarkSample {
    const previousData = new Array<BenchmarkItem>(length);
    const nextData = new Array<BenchmarkItem>(length);
    const materializedIndex = Math.floor(length / 2);
    previousData[materializedIndex] = { id: "materialized" };
    nextData[materializedIndex] = { id: "materialized" };
    let keyExtractorCalls = 0;
    const idCache: string[] = [];
    idCache[materializedIndex] = "materialized";
    const state = {
        idCache,
        pendingDataComparison: undefined,
        props: {
            itemsAreEqual: (previous: BenchmarkItem, next: BenchmarkItem) => previous.id === next.id,
            keyExtractor: (item: BenchmarkItem) => {
                keyExtractorCalls++;
                return item.id;
            },
        },
    } as unknown as InternalState;

    const durationMs = measure(() => {
        for (let iteration = 0; iteration < queryCount; iteration++) {
            checkStructuralDataChange(state, nextData, previousData);
        }
    });

    return {
        durationMs,
        keyExtractorCalls,
        knownCount: 1,
        length,
        name: "array-structural-comparison",
        queryCount,
    };
}

function benchmarkPrefixLayout(length: number, knownCount: number, queryCount: number): BenchmarkSample {
    const store = new PrefixLayoutStore(length, 20);
    for (let index = 0; index < knownCount; index++) {
        store.setMeasuredSize(getKnownIndex(index, knownCount, length), 10 + (index % 30));
    }

    let seed = 123456789;
    const durationMs = measure(() => {
        for (let iteration = 0; iteration < queryCount; iteration++) {
            seed = nextRandom(seed);
            const index = seed % length;
            const offset = store.getOffset(index);
            store.findIndexAtOffset(offset);
        }
    });

    return {
        durationMs,
        knownCount,
        length,
        name: "prefix-layout",
        queryCount,
    };
}

function benchmarkRegularGridLayout(length: number, knownCount: number, queryCount: number): BenchmarkSample {
    const store = new RowLayoutStore({ estimatedSize: 20, length, numColumns: 3 });
    for (let index = 0; index < knownCount; index++) {
        store.setMeasuredSize(getKnownIndex(index, knownCount, length), 10 + (index % 30));
    }

    let seed = 987654321;
    const durationMs = measure(() => {
        for (let iteration = 0; iteration < queryCount; iteration++) {
            seed = nextRandom(seed);
            const index = seed % length;
            store.getColumn(index);
            store.getOffset(index);
        }
    });

    return {
        durationMs,
        knownCount,
        length,
        name: "regular-grid-layout",
        queryCount,
    };
}

export function runDataSourceBaseline(options: BenchmarkOptions = {}): DataSourceBaseline {
    const knownCount = options.knownCount ?? 1_000;
    const lengths = options.lengths ?? [100_000, 1_000_000];
    const queryCount = options.queryCount ?? 10_000;
    const samples: BenchmarkSample[] = [];

    for (const length of lengths) {
        const boundedKnownCount = Math.min(knownCount, length);
        samples.push(benchmarkArrayStructuralComparison(length, queryCount));
        samples.push(benchmarkPrefixLayout(length, boundedKnownCount, queryCount));
        samples.push(benchmarkRegularGridLayout(length, boundedKnownCount, queryCount));
    }

    return {
        generatedAt: new Date().toISOString(),
        samples,
        version: 1,
    };
}

if (import.meta.main) {
    console.log(JSON.stringify(runDataSourceBaseline(), undefined, 2));
}
