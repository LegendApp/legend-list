export const checkThreshold = (
    distance: number,
    atThreshold: boolean,
    threshold: number,
    isReached: boolean,
    isBlockedByTimer: boolean,
    onReached?: (distance: number) => void,
    blockTimer?: (block: boolean) => void,
) => {
    const distanceAbs = Math.abs(distance);
    const isAtThreshold = atThreshold || distanceAbs < threshold;

    if (!isReached && !isBlockedByTimer) {
        if (isAtThreshold) {
            onReached?.(distance);
            blockTimer?.(true);
            setTimeout(() => {
                blockTimer?.(false);
            }, 700);
            return true;
        }
    } else {
        // reset flag when user scrolls back out of the threshold
        // add hysteresis to avoid multiple events triggered
        if (distance >= 1.3 * threshold) {
            return false;
        }
    }
    return isReached;
};
