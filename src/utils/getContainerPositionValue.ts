export function getContainerPositionValue(params: {
    positionValue: number;
    canUseDeferredPositionDelta: boolean;
    deferredPositionDelta: number;
    scrollAdjustPending: number;
}) {
    const { canUseDeferredPositionDelta, deferredPositionDelta, positionValue, scrollAdjustPending } = params;

    return positionValue - scrollAdjustPending - (canUseDeferredPositionDelta ? deferredPositionDelta : 0);
}
