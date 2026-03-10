export interface LegendListInternalConfig {
    label?: string;
    log: boolean;
    maxContainerPositionWritesPerPass?: number;
}

export const INTERNAL_PERF_CONFIG: LegendListInternalConfig = {
    log: true,
    maxContainerPositionWritesPerPass: undefined,
};
