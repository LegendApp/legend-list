import { PrefixLayoutStore } from "@/core/PrefixLayoutStore";

export class PrefixLayoutRuntime {
    didFlushInitialEstimate = false;
    lastFlushedEstimateMeasurementCount = 0;
    positionListenerOffsets?: Map<string, number>;
    propEstimatedSize: number;
    queuedEstimateFlush?: number;
    store: PrefixLayoutStore;

    constructor(length: number, estimatedSize: number) {
        this.propEstimatedSize = estimatedSize;
        this.store = new PrefixLayoutStore(length, estimatedSize);
    }

    resetEstimateFlushState(timeouts: Set<number>) {
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
