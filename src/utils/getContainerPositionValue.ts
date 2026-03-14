import { Platform } from "@/platform/Platform";

export function shouldUseSharedNativeContentAdjust() {
    return Platform.OS === "ios" || Platform.OS === "android";
}

export function getContainerPositionValue(params: {
    positionValue: number;
    canUseDeferredPositionDelta: boolean;
    deferredPositionDelta: number;
    scrollAdjustPending: number;
}) {
    const { canUseDeferredPositionDelta, deferredPositionDelta, positionValue, scrollAdjustPending } = params;

    if (shouldUseSharedNativeContentAdjust()) {
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
