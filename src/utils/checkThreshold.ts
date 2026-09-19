import type { ThresholdSnapshot } from "@/types.internal";

const HYSTERESIS_MULTIPLIER = 1.3;

export function isOutsideThresholdHysteresis(distance: number, atThreshold: boolean, threshold: number) {
    const absDistance = Math.abs(distance);
    return (
        (!atThreshold && threshold > 0 && absDistance >= threshold * HYSTERESIS_MULTIPLIER) ||
        (!atThreshold && threshold <= 0 && absDistance > 0)
    );
}

interface ThresholdContext {
    scrollPosition: number;
    contentSize?: number;
    dataLength?: number;
}

// Tracks when the list hits the user-specified start/end threshold and avoids flutter via hysteresis.
export const checkThreshold = (
    distance: number,
    atThreshold: boolean,
    threshold: number,
    wasReached: boolean | null,
    snapshot: ThresholdSnapshot | undefined,
    context: ThresholdContext,
    onReached: (dist: number) => boolean,
    setSnapshot: (snap: ThresholdSnapshot | undefined) => void,
) => {
    // Distance from the edge in absolute terms. Normalised for easier hysteresis checks.
    // Positive values mean we are away from the edge, negative values can happen when content shrinks.
    const absDistance = Math.abs(distance);
    // We treat the boundary as reached either when the caller explicitly says so (`atThreshold`)
    // or when the measured distance sits inside the user-provided `threshold` window.
    const within = atThreshold || (threshold > 0 && absDistance <= threshold);

    const updateSnapshot = () => {
        // Keep the threshold context current without treating later data or layout changes
        // as a new threshold entry.
        setSnapshot({
            atThreshold,
            contentSize: context.contentSize,
            dataLength: context.dataLength,
            scrollPosition: context.scrollPosition,
        });
    };

    let reached = !!wasReached;
    if (!wasReached) {
        // First time we enter this window: trigger and remember it
        // A shared edge gate may defer dispatch. Do not latch an undelivered event.
        if (within && onReached(distance)) {
            updateSnapshot();
            reached = true;
        }
    } else {
        // Add some hysteresis so that minor jitter does not constantly flip the flag
        // - When a positive threshold is set we wait until the user scrolls 30% beyond it
        // - When the threshold is zero (or negative) any movement away from the edge counts as a reset
        const reset = isOutsideThresholdHysteresis(distance, atThreshold, threshold);

        if (reset) {
            setSnapshot(undefined);
            reached = false;
        } else if (within) {
            // Keep the snapshot current without treating a data/layout change as a fresh threshold entry.
            const changed =
                !snapshot ||
                snapshot.atThreshold !== atThreshold ||
                snapshot.contentSize !== context.contentSize ||
                snapshot.dataLength !== context.dataLength;

            if (changed) {
                updateSnapshot();
            }
        }
    }
    return reached;
};
