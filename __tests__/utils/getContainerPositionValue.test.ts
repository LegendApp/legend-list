import { Platform } from "../../src/platform/Platform";
import { getContainerPositionValue, getSharedNativeContentAdjust } from "../../src/utils/getContainerPositionValue";

describe("getContainerPositionValue", () => {
    it("keeps native container positions absolute when shared content adjust is enabled", () => {
        const previousPlatform = Platform.OS;
        Platform.OS = "ios";
        try {
            expect(
                getContainerPositionValue({
                    canUseDeferredPositionDelta: true,
                    deferredPositionDelta: 81,
                    positionValue: 3845,
                    scrollAdjustPending: 12,
                }),
            ).toBe(3845);
        } finally {
            Platform.OS = previousPlatform;
        }
    });

    it("preserves existing web deferred-position math", () => {
        const previousPlatform = Platform.OS;
        Platform.OS = "web";
        try {
            expect(
                getContainerPositionValue({
                    canUseDeferredPositionDelta: true,
                    deferredPositionDelta: 81,
                    positionValue: 3845,
                    scrollAdjustPending: 12,
                }),
            ).toBe(3752);
        } finally {
            Platform.OS = previousPlatform;
        }
    });

    it("preserves existing web pending-adjust math without deferred position", () => {
        const previousPlatform = Platform.OS;
        Platform.OS = "web";
        try {
            expect(
                getContainerPositionValue({
                    canUseDeferredPositionDelta: false,
                    deferredPositionDelta: 81,
                    positionValue: 3845,
                    scrollAdjustPending: 12,
                }),
            ).toBe(3833);
        } finally {
            Platform.OS = previousPlatform;
        }
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
