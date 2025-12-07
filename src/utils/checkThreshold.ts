import type { ThresholdSnapshot } from "@/types";

const HYSTERESIS_MULTIPLIER = 1.3;

interface ThresholdContext {
    scrollPosition: number;
    contentSize?: number;
    dataLength?: number;
}

// Tracks when the list hits the user-specified start/end threshold, avoids flutter via hysteresis,
// and only re-fires when content/data actually change while still within the window.
export const checkThreshold = (
    distance: number,
    atThreshold: boolean,
    threshold: number,
    wasReached: boolean | null,
    snapshot: ThresholdSnapshot | undefined,
    context: ThresholdContext,
    onReached?: (dist: number) => void,
    setSnapshot?: (snap: ThresholdSnapshot | undefined) => void,
) => {
    // Distance from the edge in absolute terms. Normalised for easier hysteresis checks.
    // Positive values mean we are away from the edge, negative values can happen when content shrinks.
    const absDistance = Math.abs(distance);
    // We treat the boundary as reached either when the caller explicitly says so (`atThreshold`)
    // or when the measured distance sits inside the user-provided `threshold` window.
    const within = atThreshold || (threshold > 0 && absDistance <= threshold);

    // Before the threshold has ever been exited, treat wasReached as null to avoid
    // firing immediately on mount when starting inside the window.
    if (wasReached === null) {
        // Overscroll (negative distance) should still be treated as within on the initial pass.
        if (!within && distance >= 0) {
            return false;
        }
        return null;
    }

    const updateSnapshot = () => {
        // Persist the key pieces of state so that future scroll ticks can quickly decide
        // whether something meaningful changed (new content, different data length, etc.)
        // and therefore warrant firing the callback again.
        setSnapshot?.({
            atThreshold,
            contentSize: context.contentSize,
            dataLength: context.dataLength,
            scrollPosition: context.scrollPosition,
        });
    };

    if (!wasReached) {
        // First time we enter this window: trigger and remember it
        if (!within) {
            return false;
        }
        onReached?.(distance);
        updateSnapshot();
        return true;
    }

    // Add some hysteresis so that minor jitter does not constantly flip the flag
    // - When a positive threshold is set we wait until the user scrolls 30% beyond it
    // - When the threshold is zero (or negative) any movement away from the edge counts as a reset
    const reset =
        (!atThreshold && threshold > 0 && absDistance >= threshold * HYSTERESIS_MULTIPLIER) ||
        (!atThreshold && threshold <= 0 && absDistance > 0);

    if (reset) {
        setSnapshot?.(undefined);
        return false;
    }

    if (within) {
        // We are still inside the window. Only re-trigger if the list changed in a way that
        // warrants another notification (e.g. new content size or data length). Plain scroll
        // position changes inside the window are ignored to avoid infinite loops.
        const changed =
            !snapshot ||
            snapshot.atThreshold !== atThreshold ||
            snapshot.contentSize !== context.contentSize ||
            snapshot.dataLength !== context.dataLength;

        if (changed) {
            onReached?.(distance);
            updateSnapshot();
        }
    }

    return true;
};
