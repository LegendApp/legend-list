export interface LegendListInternalConfig {
    label?: string;
    log: boolean;
    maxContainerPositionWritesPerPass?: number;
    optimizeItemPositionsOnScrollUp: boolean;
}

export const INTERNAL_PERF_CONFIG: LegendListInternalConfig = {
    log: false,
    maxContainerPositionWritesPerPass: undefined,
    optimizeItemPositionsOnScrollUp: false,
};
