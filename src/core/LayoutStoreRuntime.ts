import type { PrefixLayoutStore } from "@/core/PrefixLayoutStore";
import type { RowLayoutStore } from "@/core/RowLayoutStore";

export type ActiveLayoutStore = PrefixLayoutStore | RowLayoutStore;

export interface RowSpanCacheInput {
    data: readonly unknown[];
    dataKey: unknown;
    dataVersion: unknown;
    extraData: unknown;
    numColumns: number;
    overrideItemLayout: unknown;
}

export class LayoutStoreRuntime {
    didFlushInitialEstimate = false;
    lastFlushedEstimateMeasurementCount = 0;
    positionListenerOffsets?: Map<string, number>;
    propEstimatedSize: number;
    queuedEstimateFlush?: number;
    private rowSpanCache?: {
        input: RowSpanCacheInput;
        spans: Array<number | undefined>;
    };
    store: ActiveLayoutStore;

    constructor(store: ActiveLayoutStore, estimatedSize: number) {
        this.propEstimatedSize = estimatedSize;
        this.store = store;
    }

    resetTransientState(timeouts: Set<number>) {
        if (this.queuedEstimateFlush !== undefined) {
            clearTimeout(this.queuedEstimateFlush);
            timeouts.delete(this.queuedEstimateFlush);
            this.queuedEstimateFlush = undefined;
        }
        this.didFlushInitialEstimate = false;
        this.lastFlushedEstimateMeasurementCount = 0;
        this.positionListenerOffsets = undefined;
    }

    clearRowSpanCache() {
        this.rowSpanCache = undefined;
    }

    getCachedRowSpans(input: RowSpanCacheInput) {
        return this.rowSpanCache && areRowSpanCacheInputsEqual(this.rowSpanCache.input, input)
            ? this.rowSpanCache.spans
            : undefined;
    }

    setCachedRowSpans(input: RowSpanCacheInput, spans: Array<number | undefined>) {
        this.rowSpanCache = { input, spans };
    }
}

function areRowSpanCacheInputsEqual(prev: RowSpanCacheInput, next: RowSpanCacheInput) {
    return (
        prev.data === next.data &&
        Object.is(prev.dataKey, next.dataKey) &&
        Object.is(prev.dataVersion, next.dataVersion) &&
        Object.is(prev.extraData, next.extraData) &&
        prev.numColumns === next.numColumns &&
        prev.overrideItemLayout === next.overrideItemLayout
    );
}
