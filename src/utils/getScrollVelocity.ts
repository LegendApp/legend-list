import type { InternalState } from "@/types";

export const getScrollVelocity = (state: InternalState) => {
    const { scrollHistory } = state;
    let velocity = 0;
    if (scrollHistory.length >= 1) {
        const newest = scrollHistory[scrollHistory.length - 1];
        let oldest: (typeof scrollHistory)[0] | undefined;
        let start = 0;
        const now = Date.now();

        // If there's a change in direction, remove all entries before that point
        for (let i = 0; i < scrollHistory.length - 1; i++) {
            const entry = scrollHistory[i];
            const nextEntry = scrollHistory[i + 1];

            // Check if direction changes - if so, remove older entries
            if (i > 0) {
                const prevEntry = scrollHistory[i - 1];
                const prevDirection = entry.scroll - prevEntry.scroll;
                const currentDirection = nextEntry.scroll - entry.scroll;

                // If direction changed, remove all entries before this point
                if ((prevDirection > 0 && currentDirection < 0) || (prevDirection < 0 && currentDirection > 0)) {
                    start = i;
                    break;
                }
            }
        }

        // Find oldest recent event
        for (let i = start; i < scrollHistory.length - 1; i++) {
            const entry = scrollHistory[i];
            if (now - entry.time <= 1000) {
                oldest = entry;
                break;
            }
        }

        if (oldest && oldest !== newest) {
            const scrollDiff = newest.scroll - oldest.scroll;
            const timeDiff = newest.time - oldest.time;
            velocity = timeDiff > 0 ? scrollDiff / timeDiff : 0;
        }
    }

    return velocity;
};
