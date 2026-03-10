export interface LegendListInternalConfig {
    deferPositionDeltaVisualAdjust: boolean;
    label?: string;
    log: boolean;
    maxContainerPositionWritesPerPass?: number;
    optimizeItemPositionsOnScrollUp: boolean;
    deferredPositionDeltaEnabled: boolean;
}

export const INTERNAL_PERF_CONFIG: LegendListInternalConfig = {
    deferPositionDeltaVisualAdjust: true,
    log: true,
    maxContainerPositionWritesPerPass: undefined,
    optimizeItemPositionsOnScrollUp: false,
    deferredPositionDeltaEnabled: true,
};
