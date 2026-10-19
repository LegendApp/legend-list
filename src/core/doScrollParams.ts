export interface DoScrollToParams {
    animated?: boolean;
    horizontal?: boolean;
    /**
     * Internal adjustment re-assert (old-arch Android workaround). It belongs
     * to the in-flight gesture cycle and must not claim momentum ownership.
     */
    isAdjustment?: boolean;
    isInitialScroll?: boolean;
    offset: number;
}
