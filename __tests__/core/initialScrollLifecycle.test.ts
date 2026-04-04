import { afterEach, beforeEach, describe, expect, it, type Mock, spyOn } from "bun:test";
import "../setup";

import * as checkFinishedScrollModule from "../../src/core/checkFinishedScroll";
import * as initialScrollModule from "../../src/core/initialScroll";
import {
    continueInitialScroll,
    handleInitialScrollDataChange,
    handleInitialScrollLayoutReady,
} from "../../src/core/initialScrollLifecycle";
import type { StateContext } from "../../src/state/state";
import { createMockContext } from "../__mocks__/createMockContext";

describe("initialScrollLifecycle", () => {
    let advanceMeasuredInitialScrollSpy: Mock<typeof initialScrollModule.advanceMeasuredInitialScroll>;
    let advanceOffsetInitialScrollSpy: Mock<typeof initialScrollModule.advanceOffsetInitialScroll>;
    let checkFinishedScrollSpy: Mock<typeof checkFinishedScrollModule.checkFinishedScroll>;
    let shouldQueueCompletionSpy: Mock<typeof checkFinishedScrollModule.shouldQueueAlignedInitialScrollCompletionCheck>;
    let originalRAF: typeof requestAnimationFrame;

    beforeEach(() => {
        originalRAF = globalThis.requestAnimationFrame;
        globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
            cb(0);
            return 1;
        }) as any;
        advanceMeasuredInitialScrollSpy = spyOn(initialScrollModule, "advanceMeasuredInitialScroll").mockImplementation(
            () => true,
        );
        advanceOffsetInitialScrollSpy = spyOn(initialScrollModule, "advanceOffsetInitialScroll").mockImplementation(
            () => true,
        );
        checkFinishedScrollSpy = spyOn(checkFinishedScrollModule, "checkFinishedScroll").mockImplementation(() => {});
        shouldQueueCompletionSpy = spyOn(
            checkFinishedScrollModule,
            "shouldQueueAlignedInitialScrollCompletionCheck",
        ).mockImplementation(() => false);
    });

    afterEach(() => {
        globalThis.requestAnimationFrame = originalRAF;
        advanceMeasuredInitialScrollSpy.mockRestore();
        advanceOffsetInitialScrollSpy.mockRestore();
        checkFinishedScrollSpy.mockRestore();
        shouldQueueCompletionSpy.mockRestore();
    });

    it("replays finished offset-only initial scrolls when data arrives after an empty mount", () => {
        const ctx = createMockContext(
            {},
            {
                didFinishInitialScroll: true,
                initialScroll: {
                    contentOffset: 250,
                    index: 0,
                    viewOffset: 0,
                } as StateContext["state"]["initialScroll"],
                initialScrollUsesOffset: true,
                props: {
                    data: Array.from({ length: 5 }, (_, index) => ({ id: `item-${index}` })),
                },
                queuedInitialLayout: true,
            },
        );

        handleInitialScrollDataChange(ctx, {
            dataLength: ctx.state.props.data.length,
            didDataChange: true,
            initialScrollAtEnd: false,
            previousDataLength: 0,
            stylePaddingBottom: 0,
            useBootstrapInitialScroll: false,
        });

        expect(ctx.state.didFinishInitialScroll).toBe(false);
        expect(ctx.state.initialScrollSession).toMatchObject({
            kind: "offset",
            phase: "pending",
            previousDataLength: ctx.state.props.data.length,
        });
        expect(advanceOffsetInitialScrollSpy).toHaveBeenCalledWith(
            ctx,
            expect.objectContaining({
                forceScroll: undefined,
            }),
        );
    });

    it("routes measured initial scroll continuation through the measured helper", () => {
        const ctx = createMockContext(
            {},
            {
                initialScroll: { index: 3, viewOffset: 12 } as StateContext["state"]["initialScroll"],
                initialScrollUsesOffset: false,
            },
        );

        continueInitialScroll(ctx, { waitForInitialLayout: true });

        expect(advanceMeasuredInitialScrollSpy).toHaveBeenCalledWith(
            ctx,
            expect.objectContaining({ waitForInitialLayout: true }),
        );
        expect(advanceOffsetInitialScrollSpy).not.toHaveBeenCalled();
    });

    it("routes offset-only continuation through the offset helper", () => {
        const ctx = createMockContext(
            {},
            {
                initialScroll: {
                    contentOffset: 120,
                    index: 0,
                    viewOffset: 0,
                } as StateContext["state"]["initialScroll"],
                initialScrollUsesOffset: true,
            },
        );

        continueInitialScroll(ctx, { waitForInitialLayout: true });

        expect(advanceOffsetInitialScrollSpy).toHaveBeenCalledWith(
            ctx,
            expect.objectContaining({ forceScroll: undefined }),
        );
        expect(advanceMeasuredInitialScrollSpy).not.toHaveBeenCalled();
    });

    it("replays layout-ready measured initial scrolls from the lifecycle owner", () => {
        const ctx = createMockContext(
            {},
            {
                initialScroll: { index: 5, viewOffset: 100 } as StateContext["state"]["initialScroll"],
                initialScrollUsesOffset: false,
            },
        );

        handleInitialScrollLayoutReady(ctx);

        expect(advanceMeasuredInitialScrollSpy).toHaveBeenCalledTimes(2);
        expect(advanceMeasuredInitialScrollSpy).toHaveBeenNthCalledWith(
            1,
            ctx,
            expect.objectContaining({ forceScroll: true }),
        );
        expect(advanceMeasuredInitialScrollSpy).toHaveBeenNthCalledWith(
            2,
            ctx,
            expect.objectContaining({ forceScroll: true }),
        );
    });

    it("queues aligned completion checks from lifecycle-owned layout handling", () => {
        const ctx = createMockContext(
            {},
            {
                initialScroll: { index: 5, viewOffset: 100 } as StateContext["state"]["initialScroll"],
                initialScrollUsesOffset: false,
            },
        );
        shouldQueueCompletionSpy.mockImplementation(() => true);

        handleInitialScrollLayoutReady(ctx);

        expect(checkFinishedScrollSpy).toHaveBeenCalledWith(ctx);
    });
});
