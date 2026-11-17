import { afterEach, beforeEach, expect, it } from "bun:test";
import "../setup";

import { LegendList } from "../../src/components/LegendList";
import { FeedSurface, GESTURES, installFeedClock, runFeedGesture } from "./feedScrollCommits.harness";

// React commits on 3.7.2 (26df31ae) for the same input. The device report that
// prompted this (8 vs 30) compared a drag that stopped with a fling that kept
// going through momentum and revealed a tall unmeasured row; given the same
// gesture, both versions commit the same number of times.
const COMMITS_372: Record<string, number> = { drag: 6, fling: 16 };
let clock: ReturnType<typeof installFeedClock>;

beforeEach(() => {
    clock = installFeedClock();
});

afterEach(() => {
    clock.restore();
});

it.each(Object.keys(GESTURES))("%s through a following feed commits no more than 3.7.2", async (gesture) => {
    for (const recycleItems of [false, true]) {
        const result = await runFeedGesture(
            (props) => <LegendList {...props} renderScrollComponent={(scroll: any) => <FeedSurface {...scroll} />} />,
            gesture,
            { recycleItems },
        );
        expect(result.startedAtEnd).toBe(true);
        // The scroll revealed the unmeasured tall row and MVCP absorbed its growth.
        expect(result.measuredTallRow).toBe(true);
        if (COMMITS_372[gesture] !== undefined) {
            expect(result.scrollCommits).toBeLessThanOrEqual(COMMITS_372[gesture]);
        }
        // One commit per parent render: a recreated inline viewabilityConfig adds none.
        expect(result.rerenderCommits).toBeLessThanOrEqual(5);
    }
});
