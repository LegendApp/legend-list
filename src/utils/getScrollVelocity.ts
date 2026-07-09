import type { InternalState } from "@/types.internal";

const MAX_SCROLL_VELOCITY_WINDOW_MS = 1000;
const SCROLL_VELOCITY_HALF_LIFE_MS = 200;

export const getScrollVelocity = (state: InternalState) => {
    const { scrollHistory } = state;
    const newestIndex = scrollHistory.length - 1;
    if (newestIndex < 1) {
        return 0;
    }

    const newest = scrollHistory[newestIndex];
    if (Date.now() - newest.time > MAX_SCROLL_VELOCITY_WINDOW_MS) {
        return 0;
    }

    let direction = 0;
    let weightedVelocity = 0;
    let totalWeight = 0;

    // Walk backwards over recent same-direction segments. Newer segments carry
    // more weight, but older samples still contribute when JS scroll events are delayed.
    for (let i = newestIndex; i > 0; i--) {
        const current = scrollHistory[i];
        const previous = scrollHistory[i - 1];
        const scrollDiff = current.scroll - previous.scroll;
        const timeDiff = current.time - previous.time;
        const deltaSign = Math.sign(scrollDiff);

        if (deltaSign !== 0) {
            if (direction === 0) {
                direction = deltaSign;
            } else if (deltaSign !== direction) {
                break;
            }
        }

        if (newest.time - previous.time > MAX_SCROLL_VELOCITY_WINDOW_MS) {
            break;
        }

        if (scrollDiff === 0 || timeDiff <= 0) {
            continue;
        }

        const age = newest.time - current.time;
        const weight = Math.exp(-age / SCROLL_VELOCITY_HALF_LIFE_MS);
        weightedVelocity += (scrollDiff / timeDiff) * weight;
        totalWeight += weight;
    }

    return totalWeight > 0 ? weightedVelocity / totalWeight : 0;
};
