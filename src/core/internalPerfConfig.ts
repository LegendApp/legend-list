export interface LegendListInternalConfig {
    deferSharedOriginVisualAdjust: boolean;
    label?: string;
    log: boolean;
    maxContainerPositionWritesPerPass?: number;
    optimizeItemPositionsOnScrollUp: boolean;
    sharedOriginEnabled: boolean;
}

export const INTERNAL_PERF_CONFIG: LegendListInternalConfig = {
    deferSharedOriginVisualAdjust: true,
    log: true,
    maxContainerPositionWritesPerPass: undefined,
    optimizeItemPositionsOnScrollUp: false,
    sharedOriginEnabled: true,
};
