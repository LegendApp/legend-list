import type { ThresholdSnapshot } from "@/types.internal";

const HYSTERESIS_MULTIPLIER = 1.3;

export function isOutsideThresholdHysteresis(distance: number, atThreshold: boolean, threshold: number) {
    const absDistance = Math.abs(distance);
    return (
        (!atThreshold && threshold > 0 && absDistance >= threshold * HYSTERESIS_MULTIPLIER) ||
        (!atThreshold && threshold <= 0 && absDistance > 0)
    );
}

// A new length re-arms an edge. A new array of the same length re-arms it only with a content size
// change. Replacing an array without measured content progress does not re-arm it, nor does
// data that arrives while the callback's request is pending.
export function didThresholdDataChange(snapshot: ThresholdSnapshot | undefined, context: ThresholdSnapshot) {
    return (
        !!snapshot &&
        !snapshot.isRequestPending &&
        (snapshot.dataLength !== context.dataLength ||
            (snapshot.data !== context.data && snapshot.contentSize !== context.contentSize))
    );
}

// Dispatch once per qualifying data change and retain delivery across stationary layout changes.
export const checkThreshold = (
    distance: number,
    atThreshold: boolean,
    threshold: number,
    wasReached: boolean | null,
    snapshot: ThresholdSnapshot | undefined,
    context: ThresholdSnapshot,
    onReached: (dist: number) => boolean,
    setSnapshot: (snap: ThresholdSnapshot | undefined) => void,
    allowEmptyDataChange = false,
) => {
    // Distance from the edge in absolute terms.
    // Positive values mean we are away from the edge, negative values can happen when content shrinks.
    const absDistance = Math.abs(distance);
    // We treat the boundary as reached either when the caller explicitly says so (`atThreshold`)
    // or when the measured distance sits inside the user-provided `threshold` window.
    const within =
        (context.dataLength !== 0 || allowEmptyDataChange) &&
        (atThreshold || (threshold > 0 && absDistance <= threshold));
    const didScroll = snapshot?.scroll !== context.scroll;
    // Observe motion inside the hysteresis band before a later layout-only exit.
    if (snapshot) snapshot.scroll = context.scroll;

    if (!within) {
        if (
            (context.dataLength === 0 ||
                (didScroll && isOutsideThresholdHysteresis(distance, atThreshold, threshold))) &&
            (wasReached || snapshot)
        ) {
            setSnapshot(undefined);
        }
        return false;
    }

    // The admission owner records successful dispatches before invoking user callbacks.
    if ((!wasReached || didThresholdDataChange(snapshot, context)) && onReached(distance)) {
        return true;
    }
    return !!wasReached;
};
