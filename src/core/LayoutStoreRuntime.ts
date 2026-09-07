import type { PrefixLayoutStore } from "@/core/PrefixLayoutStore";
import type { RowLayoutStore } from "@/core/RowLayoutStore";
import { moveSpans, spliceSpans } from "@/core/rowSpanMutations";
import type { DataSourceOperation } from "@/types.base";

export type ActiveLayoutStore = PrefixLayoutStore | RowLayoutStore;

export interface RowSpanCacheInput {
    data: unknown;
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
    private rowSpanCache?: {
        input: RowSpanCacheInput;
        spans: Array<number | undefined>;
    };
    store: ActiveLayoutStore;

    constructor(store: ActiveLayoutStore, estimatedSize: number) {
        this.propEstimatedSize = estimatedSize;
        this.store = store;
    }

    resetTransientState() {
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

    transformCachedRowSpans(operations: readonly DataSourceOperation[]) {
        const spans = this.rowSpanCache?.spans;
        if (spans) {
            for (const operation of operations) {
                if (operation.type === "splice") {
                    spliceSpans(spans, operation.index, operation.deleteCount, operation.insertCount, undefined);
                } else if (operation.type === "move" && operation.count > 0 && operation.from !== operation.to) {
                    moveSpans(spans, operation.from, operation.to, operation.count);
                }
            }
        }
        return spans;
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
