// Momentum frames can be ~80ms apart; a 100ms gap allows for delivery jitter.
const WHEEL_GESTURE_GAP_MS = 100;

export interface WheelGesture {
    delta: number;
    time: number;
    peak: number;
    decaying: boolean;
    momentum?: boolean;
    isNew: boolean;
}

export function normalizeWheelDelta(delta: number, mode: number, pageSize: number) {
    return delta * (mode === 1 ? 16 : mode === 2 && pageSize > 0 ? pageSize : 1);
}

export function getWheelGesture(
    previous: WheelGesture | undefined,
    delta: number,
    time: number,
    momentum?: boolean,
): WheelGesture {
    const magnitude = Math.abs(delta);
    const isNew =
        momentum !== true &&
        (!previous ||
            time - previous.time > WHEEL_GESTURE_GAP_MS ||
            Math.sign(delta) !== Math.sign(previous.delta) ||
            (momentum === false && previous.momentum === true) ||
            (momentum === undefined &&
                previous.decaying &&
                magnitude >= Math.max(10, previous.peak * 0.5) &&
                magnitude > Math.abs(previous.delta) * 1.5));
    const peak = !previous || isNew ? magnitude : Math.max(previous.peak, magnitude);
    const decaying = !isNew && (!!previous?.decaying || magnitude < peak * 0.8);
    return { decaying, delta, isNew, momentum, peak, time };
}
