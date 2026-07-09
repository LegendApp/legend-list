import { heapStats } from "bun:jsc";
import { PrefixLayoutStore } from "../src/core/PrefixLayoutStore";

function measure(callback: () => void) {
    const start = performance.now();
    callback();
    return performance.now() - start;
}

function runSparseSequenceLayoutBenchmark() {
    Bun.gc(true);
    const before = heapStats();
    const store = new PrefixLayoutStore(1_000_000, 20);
    const materializeMs = measure(() => {
        for (let index = 0; index < 100_000; index++) {
            store.setMeasuredSize(index, 20 + (index % 7));
        }
    });
    const totalSize = store.getTotalSize();
    const forcedGcMs = measure(() => Bun.gc(true));
    const after = heapStats();

    const prependMs = measure(() => store.splice(0, 0, 1));
    const moveMs = measure(() => store.move(25_000, 750_000, 10_000));

    return {
        forcedGcMs,
        heapSizeDelta: after.heapSize - before.heapSize,
        materializeMs,
        measuredCount: store.getMeasuredCount(),
        moveMs,
        objectCountDelta: after.objectCount - before.objectCount,
        prependMs,
        stats: store.getDebugStats(),
        totalSize,
    };
}

console.log(JSON.stringify(runSparseSequenceLayoutBenchmark(), undefined, 2));
