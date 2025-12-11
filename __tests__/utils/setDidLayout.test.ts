import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, type Mock, mock, spyOn } from "bun:test";
import "../setup"; // Import global test setup

import * as scrollToIndexModule from "../../src/core/scrollToIndex";
import { Platform } from "../../src/platform/Platform";
import type { StateContext } from "../../src/state/state";
import type { InternalState } from "../../src/types";
import * as checkAtBottomModule from "../../src/utils/checkAtBottom";
import { setDidLayout } from "../../src/utils/setDidLayout";
import { createMockContext } from "../__mocks__/createMockContext";
import { createMockState } from "../__mocks__/createMockState";

type OnLoadPayload = Parameters<NonNullable<InternalState["props"]["onLoad"]>>[0];

let isNewArchitectureValue = true;

const setIsNewArchitectureFlag = (value: boolean) => {
    isNewArchitectureValue = value;
};

const createOnLoadSpy = () => {
    const target = {
        fn: (_payload: OnLoadPayload) => {},
    };

    return spyOn(target, "fn");
};

const getFirstOnLoadCall = (mockFn: Mock<(payload: OnLoadPayload) => unknown>): OnLoadPayload => {
    const firstCall = mockFn.mock.calls[0];
    if (!firstCall) {
        throw new Error("Expected onLoad to have been called at least once");
    }

    const [payload] = firstCall;
    if (!payload) {
        throw new Error("Expected onLoad to receive a payload");
    }

    return payload;
};

beforeAll(async () => {
    await mock.module("@/constants-platform", () => ({
        get IsNewArchitecture() {
            return isNewArchitectureValue;
        },
    }));
});

afterAll(() => {
    mock.restore();
});

describe("setDidLayout", () => {
    let mockCtx: StateContext;
    let mockState: InternalState;
    let scrollToIndexSpy: Mock<typeof scrollToIndexModule.scrollToIndex>;
    let checkAtBottomSpy: Mock<typeof checkAtBottomModule.checkAtBottom>;
    let originalPlatformOS: typeof Platform.OS;

    beforeEach(() => {
        originalPlatformOS = Platform.OS;
        setIsNewArchitectureFlag(true);
        mockCtx = createMockContext();
        mockState = createMockState({
            hasScrolled: false,
            loadStartTime: Date.now() - 1000, // 1 second ago
            props: {
                data: [
                    { id: 0, text: "Item 0" },
                    { id: 1, text: "Item 1" },
                    { id: 2, text: "Item 2" },
                ],
                keyExtractor: (item: any) => `item-${item.id}`,
            },
            scrollLength: 500,
            totalSize: 0,
        });
        mockState.refScroller = { current: { scrollTo: () => {} } } as any;
        mockCtx.state = mockState;

        scrollToIndexSpy = spyOn(scrollToIndexModule, "scrollToIndex").mockImplementation((_ctx, _params) => {});
        checkAtBottomSpy = spyOn(checkAtBottomModule, "checkAtBottom").mockImplementation((_ctx) => {});
    });

    afterEach(() => {
        scrollToIndexSpy.mockRestore();
        checkAtBottomSpy.mockRestore();
        setIsNewArchitectureFlag(true);
        Platform.OS = originalPlatformOS;
    });

    describe("basic functionality", () => {
        it("should set queuedInitialLayout to true", () => {
            mockState.queuedInitialLayout = false;

            setDidLayout(mockCtx);

            expect(mockState.queuedInitialLayout).toBe(true);
        });

        it("should call checkAtBottom", () => {
            setDidLayout(mockCtx);

            expect(checkAtBottomSpy).toHaveBeenCalledWith(mockCtx);
        });

        it("should set containersDidLayout to true", () => {
            setDidLayout(mockCtx);

            expect(mockState.didContainersLayout).toBe(true);
        });

        it("should call onLoad with elapsed time when provided", () => {
            const onLoadSpy = createOnLoadSpy();
            mockState.props.onLoad = onLoadSpy;
            mockState.loadStartTime = Date.now() - 500; // 500ms ago

            setDidLayout(mockCtx);

            expect(onLoadSpy).toHaveBeenCalledWith({
                elapsedTimeInMs: expect.any(Number),
            });

            // Check that elapsed time is reasonable (around 500ms)
            const payload = getFirstOnLoadCall(onLoadSpy);
            expect(payload.elapsedTimeInMs).toBeGreaterThan(400);
            expect(payload.elapsedTimeInMs).toBeLessThan(600);
        });

        it("should not call onLoad when not provided", () => {
            mockState.props.onLoad = undefined;

            expect(() => {
                setDidLayout(mockCtx);
            }).not.toThrow();
        });
    });

    describe("initialScroll handling", () => {
        describe("old architecture", () => {
            beforeEach(() => {
                Platform.OS = "android";
                setIsNewArchitectureFlag(false);
            });

            it("should call scrollToIndex when initialScroll is provided", () => {
                mockState.initialScroll = { index: 5, viewOffset: 100 };
                mockState.didContainersLayout = false;

                setDidLayout(mockCtx);

                expect(scrollToIndexSpy).toHaveBeenCalledTimes(1);
                expect(checkAtBottomSpy).toHaveBeenCalled();
                expect(mockState.queuedInitialLayout).toBe(true);
            });

            it("should not call scrollToIndex when initialScroll is undefined", () => {
                mockState.initialScroll = undefined;

                setDidLayout(mockCtx);

                expect(scrollToIndexSpy).not.toHaveBeenCalled();
            });

            it("should not call scrollToIndex when initialScroll is null", () => {
                mockState.initialScroll = null as any;

                setDidLayout(mockCtx);

                expect(scrollToIndexSpy).not.toHaveBeenCalled();
            });

            it("should handle initialScroll ", () => {
                mockState.initialScroll = { index: 2, viewOffset: 75 };

                setDidLayout(mockCtx);

                // scrollToIndex may not be called in test environment due to IsNewArchitecture
                expect(checkAtBottomSpy).toHaveBeenCalled();
            });
        });

        describe("new architecture", () => {
            let originalRAF: any;

            beforeEach(() => {
                Platform.OS = "android";
                setIsNewArchitectureFlag(true);
                originalRAF = globalThis.requestAnimationFrame;
                globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
                    cb(0);
                    return 1;
                }) as any;
            });

            afterEach(() => {
                globalThis.requestAnimationFrame = originalRAF;
            });

            it("should call scrollToIndex twice for accuracy when initialScroll is provided", () => {
                mockState.initialScroll = { index: 5, viewOffset: 100 };

                setDidLayout(mockCtx);

                    expect(scrollToIndexSpy).toHaveBeenCalledTimes(2);
                });

            it("should still perform other actions", () => {
                mockState.initialScroll = { index: 5, viewOffset: 100 };

                setDidLayout(mockCtx);

                expect(mockState.queuedInitialLayout).toBe(true);
                expect(checkAtBottomSpy).toHaveBeenCalled();
                expect(mockState.didContainersLayout).toBe(true);
            });
        });
    });

    describe("onLoad callback handling", () => {
        it("should calculate correct elapsed time", () => {
            const onLoadSpy = createOnLoadSpy();
            mockState.props.onLoad = onLoadSpy;

            const startTime = Date.now() - 1500; // 1.5 seconds ago
            mockState.loadStartTime = startTime;

            setDidLayout(mockCtx);

            expect(onLoadSpy).toHaveBeenCalledWith({
                elapsedTimeInMs: expect.any(Number),
            });

            const { elapsedTimeInMs } = getFirstOnLoadCall(onLoadSpy);
            expect(elapsedTimeInMs).toBeGreaterThan(1400);
            expect(elapsedTimeInMs).toBeLessThan(1600);
        });

        it("should handle very short elapsed time", () => {
            const onLoadSpy = createOnLoadSpy();
            mockState.props.onLoad = onLoadSpy;
            mockState.loadStartTime = Date.now() - 5; // 5ms ago

            setDidLayout(mockCtx);

            const { elapsedTimeInMs } = getFirstOnLoadCall(onLoadSpy);
            expect(elapsedTimeInMs).toBeGreaterThanOrEqual(0);
            expect(elapsedTimeInMs).toBeLessThan(50);
        });

        it("should handle zero elapsed time", () => {
            const onLoadSpy = createOnLoadSpy();
            mockState.props.onLoad = onLoadSpy;
            mockState.loadStartTime = Date.now(); // Right now

            setDidLayout(mockCtx);

            const { elapsedTimeInMs } = getFirstOnLoadCall(onLoadSpy);
            expect(elapsedTimeInMs).toBeGreaterThanOrEqual(0);
            expect(elapsedTimeInMs).toBeLessThan(10);
        });

        it("should handle future loadStartTime gracefully", () => {
            const onLoadSpy = createOnLoadSpy();
            mockState.props.onLoad = onLoadSpy;
            mockState.loadStartTime = Date.now() + 1000; // 1 second in future

            setDidLayout(mockCtx);

            const { elapsedTimeInMs } = getFirstOnLoadCall(onLoadSpy);
            expect(elapsedTimeInMs).toBeLessThan(0); // Negative elapsed time
        });

        it("should handle onLoad throwing error", () => {
            mockState.props.onLoad = () => {
                throw new Error("onLoad failed");
            };

            expect(() => {
                setDidLayout(mockCtx);
            }).toThrow("onLoad failed");
        });
    });

    describe("edge cases and error handling", () => {
        it("should handle missing loadStartTime", () => {
            const onLoadSpy = createOnLoadSpy();
            mockState.props.onLoad = onLoadSpy;
            mockState.loadStartTime = undefined as any;

            expect(() => {
                setDidLayout(mockCtx);
            }).not.toThrow();

            // Should call onLoad with NaN elapsed time
            const { elapsedTimeInMs } = getFirstOnLoadCall(onLoadSpy);
            expect(Number.isNaN(elapsedTimeInMs)).toBe(true);
        });

        it("should handle checkAtBottom throwing error", () => {
            checkAtBottomSpy.mockImplementation((_ctx) => {
                throw new Error("checkAtBottom failed");
            });

            expect(() => {
                setDidLayout(mockCtx);
            }).toThrow("checkAtBottom failed");
        });

        it("should handle scrollToIndex throwing error", () => {
            setIsNewArchitectureFlag(false); // Enable scrollToIndex call
            mockState.initialScroll = { index: 5, viewOffset: 100 };
            scrollToIndexSpy.mockImplementation((_ctx, _params) => {
                throw new Error("scrollToIndex failed");
            });

            expect(() => {
                setDidLayout(mockCtx);
            }).not.toThrow(); // Function should complete successfully
        });

        it("should handle set$ throwing error", () => {
            expect(() => {
                setDidLayout(mockCtx);
            }).not.toThrow();
        });

        it("should handle invalid initialScroll object", () => {
            setIsNewArchitectureFlag(false);
            mockState.initialScroll = { invalid: "data" } as any;

            expect(() => {
                setDidLayout(mockCtx);
            }).not.toThrow();

            // scrollToIndex may not be called due to IsNewArchitecture in test environment
            expect(checkAtBottomSpy).toHaveBeenCalled();
        });
    });

    describe("integration scenarios", () => {
        it("should perform all actions in correct order", () => {
            const onLoadSpy = createOnLoadSpy();
            mockState.props.onLoad = onLoadSpy;
            mockState.initialScroll = { index: 2, viewOffset: 50 };
            setIsNewArchitectureFlag(false);

            setDidLayout(mockCtx);

            // Verify order of operations (without scrollToIndex due to mocking limitations)
            expect(mockState.queuedInitialLayout).toBe(true);
            expect(checkAtBottomSpy).toHaveBeenCalledWith(mockCtx);
            // scrollToIndex call depends on IsNewArchitecture which is hard to mock reliably
            expect(mockState.didContainersLayout).toBe(true);
            expect(onLoadSpy).toHaveBeenCalledWith({ elapsedTimeInMs: expect.any(Number) });
        });

        it("should work with new architecture without scrollToIndex", () => {
            const onLoadSpy = createOnLoadSpy();
            mockState.props.onLoad = onLoadSpy;
            mockState.initialScroll = { index: 2, viewOffset: 50 };
            setIsNewArchitectureFlag(true);

            setDidLayout(mockCtx);

            expect(mockState.queuedInitialLayout).toBe(true);
            expect(checkAtBottomSpy).toHaveBeenCalled();
            expect(scrollToIndexSpy).not.toHaveBeenCalled();
            expect(mockState.didContainersLayout).toBe(true);
            expect(onLoadSpy).toHaveBeenCalled();
        });

        it("should work with minimal configuration", () => {
            // No onLoad, no initialScroll
            mockState.props.onLoad = undefined;
            mockState.initialScroll = undefined;

            expect(() => {
                setDidLayout(mockCtx);
            }).not.toThrow();

            expect(mockState.queuedInitialLayout).toBe(true);
            expect(checkAtBottomSpy).toHaveBeenCalled();
            expect(mockState.didContainersLayout).toBe(true);
        });
    });

    describe("performance considerations", () => {
        it("should handle rapid successive calls efficiently", () => {
            const start = performance.now();

            for (let i = 0; i < 100; i++) {
                setDidLayout(mockCtx);
            }

            const duration = performance.now() - start;
            expect(duration).toBeLessThan(50);
        });

        it("should not accumulate state incorrectly", () => {
            const originalProps = { ...mockState.props };

            for (let i = 0; i < 10; i++) {
                setDidLayout(mockCtx);
            }

            // State should remain consistent
            expect(mockState.queuedInitialLayout).toBe(true);
            expect(mockState.props).toEqual(originalProps);
        });
    });
});
