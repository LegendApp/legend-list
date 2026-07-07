import type { PrefixLayoutStore } from "@/core/PrefixLayoutStore";
import type { RowLayoutStore } from "@/core/RowLayoutStore";

export type ActiveLayoutStore = PrefixLayoutStore | RowLayoutStore;

export class LayoutStoreRuntime {
    didFlushInitialEstimate = false;
    lastFlushedEstimateMeasurementCount = 0;
    positionListenerOffsets?: Map<string, number>;
    propEstimatedSize: number;
    queuedEstimateFlush?: number;
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
}
