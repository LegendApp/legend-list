import { PixelRatio } from "@/platform/PixelRatio";

const FLOATING_POINT_SLACK = 0.01;

export const NATIVE_LAYOUT_MEASUREMENT_EPSILON = 1 / PixelRatio.get() + FLOATING_POINT_SLACK;

function isWithinEpsilon(delta: number) {
    return Math.abs(delta) <= NATIVE_LAYOUT_MEASUREMENT_EPSILON;
}

export function isNativeLayoutNoise(delta: number) {
    return isWithinEpsilon(delta);
}

export function isNativeLayoutSizeNoise(heightDelta: number, widthDelta: number) {
    return isWithinEpsilon(heightDelta) && isWithinEpsilon(widthDelta);
}
