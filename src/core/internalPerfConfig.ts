export interface LegendListInternalConfig {
    disableSharedOriginVisualAdjust: boolean;
    label?: string;
    log: boolean;
    maxContainerPositionWritesPerPass?: number;
    optimizeItemPositionsOnScrollUp: boolean;
    sharedContainerOrigin: boolean;
}

export const INTERNAL_PERF_CONFIG: LegendListInternalConfig = {
    disableSharedOriginVisualAdjust: false,
    log: false,
    maxContainerPositionWritesPerPass: undefined,
    optimizeItemPositionsOnScrollUp: false,
    sharedContainerOrigin: true,
};
