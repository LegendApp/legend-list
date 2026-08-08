import type { PrefixLayoutStore } from "@/core/PrefixLayoutStore";
import type { RowLayoutStore } from "@/core/RowLayoutStore";
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
                    spliceUnknownSpans(spans, operation.index, operation.deleteCount, operation.insertCount);
                } else if (operation.type === "move" && operation.count > 0 && operation.from !== operation.to) {
                    moveSpans(spans, operation.from, operation.to, operation.count);
                }
            }
        }
        return spans;
    }
}

function moveSpans(spans: Array<number | undefined>, from: number, to: number, count: number) {
    const moved = spans.slice(from, from + count);
    if (to < from) {
        spans.copyWithin(to + count, to, from);
    } else {
        spans.copyWithin(from, from + count, to + count);
    }
    for (let index = 0; index < count; index++) {
        spans[to + index] = moved[index];
    }
}

function spliceUnknownSpans(spans: Array<number | undefined>, index: number, deleteCount: number, insertCount: number) {
    const previousLength = spans.length;
    const nextLength = previousLength - deleteCount + insertCount;
    if (insertCount > deleteCount) {
        spans.length = nextLength;
        spans.copyWithin(index + insertCount, index + deleteCount, previousLength);
    } else if (insertCount < deleteCount) {
        spans.copyWithin(index + insertCount, index + deleteCount, previousLength);
        spans.length = nextLength;
    }
    spans.fill(undefined, index, index + insertCount);
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
