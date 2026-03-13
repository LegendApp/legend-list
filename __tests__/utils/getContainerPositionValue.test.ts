import { getContainerPositionValue, getSharedNativeContentAdjust } from "../../src/utils/getContainerPositionValue";

describe("getContainerPositionValue", () => {
    it("keeps native container positions absolute when shared content adjust is enabled", () => {
        expect(
            getContainerPositionValue({
                canUseDeferredPositionDelta: true,
                deferredPositionDelta: 81,
                positionValue: 3845,
                scrollAdjustPending: 12,
                useSharedNativeContentAdjust: true,
            }),
        ).toBe(3845);
    });

    it("preserves existing web deferred-position math", () => {
        expect(
            getContainerPositionValue({
                canUseDeferredPositionDelta: true,
                deferredPositionDelta: 81,
                positionValue: 3845,
                scrollAdjustPending: 12,
                useSharedNativeContentAdjust: false,
            }),
        ).toBe(3752);
    });

    it("preserves existing web pending-adjust math without deferred position", () => {
        expect(
            getContainerPositionValue({
                canUseDeferredPositionDelta: false,
                deferredPositionDelta: 81,
                positionValue: 3845,
                scrollAdjustPending: 12,
                useSharedNativeContentAdjust: false,
            }),
        ).toBe(3833);
    });
});

describe("getSharedNativeContentAdjust", () => {
    it("combines deferred and pending native visual compensation into one shared offset", () => {
        expect(
            getSharedNativeContentAdjust({
                deferredPositionVisualAdjust: 81,
                scrollAdjustPending: 12,
            }),
        ).toBe(-93);
    });
});
