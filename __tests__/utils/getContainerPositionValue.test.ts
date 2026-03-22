import { Platform } from "../../src/platform/Platform";
import { getContainerPositionValue } from "../../src/utils/getContainerPositionValue";

describe("getContainerPositionValue", () => {
    it("applies deferred-position math on native", () => {
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
            ).toBe(3752);
        } finally {
            Platform.OS = previousPlatform;
        }
    });

    it("applies deferred-position math on web", () => {
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
