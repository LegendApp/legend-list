import type { InternalState } from "@/types";

export const getScrollVelocity = (state: InternalState) => {
    const { scrollHistory } = state;
    const newestIndex = scrollHistory.length - 1;
    if (newestIndex < 1) {
        return 0;
    }

    const newest = scrollHistory[newestIndex];
    const now = Date.now();

    // Find the most recent non-zero movement to establish direction
    let direction = 0;
    for (let i = newestIndex; i > 0; i--) {
        const delta = scrollHistory[i].scroll - scrollHistory[i - 1].scroll;
        if (delta !== 0) {
            direction = Math.sign(delta);
            break;
        }
    }

    if (direction === 0) {
        return 0;
    }

    let oldest = newest;

    // Walk backwards until we hit a direction change or exit the 1s window
    for (let i = newestIndex - 1; i >= 0; i--) {
        const current = scrollHistory[i];
        const next = scrollHistory[i + 1];
        const delta = next.scroll - current.scroll;
        const deltaSign = Math.sign(delta);

        if (deltaSign !== 0 && deltaSign !== direction) {
            break;
        }

        if (now - current.time > 1000) {
            break;
        }

        oldest = current;
    }

    const scrollDiff = newest.scroll - oldest.scroll;
    const timeDiff = newest.time - oldest.time;
    return timeDiff > 0 ? scrollDiff / timeDiff : 0;
};
