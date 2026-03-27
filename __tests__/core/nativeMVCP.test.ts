import { describe, expect, it } from "bun:test";

import { shouldEnableNativeMVCPProp } from "../../src/core/nativeMVCP";
import { createMockState } from "../__mocks__/createMockState";

describe("nativeMVCP", () => {
    it("enables the native prop when mvcp is configured and bootstrap is inactive", () => {
        expect(
            shouldEnableNativeMVCPProp(
                createMockState({
                    props: {
                        maintainVisibleContentPosition: {
                            data: true,
                            size: false,
                        },
                    },
                }),
            ),
        ).toBe(true);
    });

    it("disables the native prop while bootstrap still owns startup", () => {
        expect(
            shouldEnableNativeMVCPProp(
                createMockState({
                    initialBootstrap: {
                        commitStableFrames: 0,
                        expectsObservedPlatformSettle: false,
                        phase: "projecting",
                        projectionOffset: 0,
                        stableFrames: 0,
                        target: {
                            indexHint: 2,
                            viewOffset: 0,
                            viewPosition: 0,
                        },
                    },
                    props: {
                        maintainVisibleContentPosition: {
                            data: true,
                            size: true,
                        },
                    },
                }),
            ),
        ).toBe(false);
    });
});
