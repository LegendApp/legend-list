export function getContainerPositionValue(params: {
    positionValue: number;
    canUseDeferredPositionDelta: boolean;
    deferredPositionDelta: number;
    scrollAdjustPending: number;
    useSharedNativeContentAdjust: boolean;
}) {
    const {
        canUseDeferredPositionDelta,
        deferredPositionDelta,
        positionValue,
        scrollAdjustPending,
        useSharedNativeContentAdjust,
    } = params;

    if (useSharedNativeContentAdjust) {
        return positionValue;
    }

    return canUseDeferredPositionDelta
        ? positionValue - deferredPositionDelta - scrollAdjustPending
        : positionValue - scrollAdjustPending;
}

export function getSharedNativeContentAdjust(params: {
    deferredPositionVisualAdjust: number;
    scrollAdjustPending: number;
}) {
    const { deferredPositionVisualAdjust, scrollAdjustPending } = params;
    return -(deferredPositionVisualAdjust + scrollAdjustPending);
}
