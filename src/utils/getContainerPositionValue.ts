import { Platform } from "@/platform/Platform";

export function getContainerPositionValue(params: {
    positionValue: number;
    canUseDeferredPositionDelta: boolean;
    deferredPositionDelta: number;
    scrollAdjustPending: number;
}) {
    const { canUseDeferredPositionDelta, deferredPositionDelta, positionValue, scrollAdjustPending } = params;

    if (Platform.OS === "ios" || Platform.OS === "android") {
        return positionValue;
    }

    return positionValue - scrollAdjustPending - (canUseDeferredPositionDelta ? deferredPositionDelta : 0);
}
