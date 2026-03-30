import type { InternalState } from "@/types.base";
import { getDebugOverlayStatsSnapshot, recordDebugOverlayEvent } from "@/utils/debugOverlayStats";
import { afterEach, describe, expect, it } from "bun:test";

describe("debugOverlayStats", () => {
    const originalDateNow = Date.now;

    afterEach(() => {
        Date.now = originalDateNow;
    });

    it("tracks recent container and PositionView activity in a rolling 5 second window", () => {
        let now = 1000;
        Date.now = () => now;

        const state = { debugOverlayEnabled: true } as InternalState;

        recordDebugOverlayEvent(state, "containerRenders", { id: 1 });
        recordDebugOverlayEvent(state, "containerRenders", { id: 1 });
        recordDebugOverlayEvent(state, "positionViewCommits", { id: 3 });

        now += 3000;
        recordDebugOverlayEvent(state, "containerRenders", { id: 2 });
        recordDebugOverlayEvent(state, "positionViewCommits", { id: 3 });
        recordDebugOverlayEvent(state, "positionViewCommits", { id: 4 });

        expect(getDebugOverlayStatsSnapshot(state)).toEqual({
            containerRenders: 3,
            hottestContainerId: 1,
            hottestContainerRenders: 2,
            hottestPositionViewCommits: 2,
            hottestPositionViewId: 3,
            positionViewCommits: 3,
            uniqueContainers: 2,
            uniquePositionViews: 2,
            windowMs: 5000,
        });

        now += 2501;

        expect(getDebugOverlayStatsSnapshot(state)).toEqual({
            containerRenders: 1,
            hottestContainerId: 2,
            hottestContainerRenders: 1,
            hottestPositionViewCommits: 1,
            hottestPositionViewId: 3,
            positionViewCommits: 2,
            uniqueContainers: 1,
            uniquePositionViews: 2,
            windowMs: 5000,
        });
    });

    it("stays empty when the overlay is disabled", () => {
        const state = { debugOverlayEnabled: false } as InternalState;

        recordDebugOverlayEvent(state, "containerRenders", { id: 1 });
        recordDebugOverlayEvent(state, "positionViewCommits", { id: 1 });

        expect(getDebugOverlayStatsSnapshot(state)).toEqual({
            containerRenders: 0,
            hottestContainerRenders: 0,
            hottestPositionViewCommits: 0,
            positionViewCommits: 0,
            uniqueContainers: 0,
            uniquePositionViews: 0,
            windowMs: 5000,
        });
    });
});
