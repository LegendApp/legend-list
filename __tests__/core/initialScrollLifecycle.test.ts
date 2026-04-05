import { afterEach, beforeEach, describe, expect, it, type Mock, spyOn } from "bun:test";
import "../setup";

import * as checkFinishedScrollModule from "../../src/core/checkFinishedScroll";
import * as initialScrollModule from "../../src/core/initialScroll";
import { handleInitialScrollDataChange, handleInitialScrollLayoutReady } from "../../src/core/initialScrollLifecycle";
import type { StateContext } from "../../src/state/state";
import { createMockContext } from "../__mocks__/createMockContext";

describe("initialScrollLifecycle", () => {
    let advanceCurrentInitialScrollSessionSpy: Mock<typeof initialScrollModule.advanceCurrentInitialScrollSession>;
    let checkFinishedScrollSpy: Mock<typeof checkFinishedScrollModule.checkFinishedScroll>;
    let originalRAF: typeof requestAnimationFrame;

    beforeEach(() => {
        originalRAF = globalThis.requestAnimationFrame;
        globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
            cb(0);
            return 1;
        }) as any;
        advanceCurrentInitialScrollSessionSpy = spyOn(
            initialScrollModule,
            "advanceCurrentInitialScrollSession",
        ).mockImplementation(() => true);
        checkFinishedScrollSpy = spyOn(checkFinishedScrollModule, "checkFinishedScroll").mockImplementation(() => {});
    });

    afterEach(() => {
        globalThis.requestAnimationFrame = originalRAF;
        advanceCurrentInitialScrollSessionSpy.mockRestore();
        checkFinishedScrollSpy.mockRestore();
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
                initialScrollSession: {
                    kind: "offset",
                    previousDataLength: 0,
                } as StateContext["state"]["initialScrollSession"],
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
            stylePaddingBottom: 0,
            useBootstrapInitialScroll: false,
        });

        expect(ctx.state.didFinishInitialScroll).toBe(false);
        expect(ctx.state.initialScrollSession).toMatchObject({
            kind: "offset",
            previousDataLength: ctx.state.props.data.length,
        });
        expect(advanceCurrentInitialScrollSessionSpy).toHaveBeenCalledWith(
            ctx,
            expect.objectContaining({ waitForInitialLayout: undefined }),
        );
    });

    it("replays layout-ready measured initial scrolls from the lifecycle owner", () => {
        const ctx = createMockContext(
            {},
            {
                initialScroll: { index: 5, viewOffset: 100 } as StateContext["state"]["initialScroll"],
                initialScrollSession: {
                    kind: "bootstrap",
                    previousDataLength: 0,
                } as StateContext["state"]["initialScrollSession"],
            },
        );

        handleInitialScrollLayoutReady(ctx);

        expect(advanceCurrentInitialScrollSessionSpy).toHaveBeenCalledTimes(2);
        expect(advanceCurrentInitialScrollSessionSpy).toHaveBeenNthCalledWith(
            1,
            ctx,
            expect.objectContaining({ forceScroll: true }),
        );
        expect(advanceCurrentInitialScrollSessionSpy).toHaveBeenNthCalledWith(
            2,
            ctx,
            expect.objectContaining({ forceScroll: true }),
        );
    });

    it("does not schedule a second layout-ready pass for offset-only initial scrolls", () => {
        const ctx = createMockContext(
            {},
            {
                initialScroll: {
                    contentOffset: 250,
                    index: 0,
                    viewOffset: 0,
                } as StateContext["state"]["initialScroll"],
                initialScrollSession: {
                    kind: "offset",
                    previousDataLength: 0,
                } as StateContext["state"]["initialScrollSession"],
            },
        );

        handleInitialScrollLayoutReady(ctx);

        expect(advanceCurrentInitialScrollSessionSpy).toHaveBeenCalledTimes(1);
        expect(advanceCurrentInitialScrollSessionSpy).toHaveBeenCalledWith(
            ctx,
            expect.objectContaining({ forceScroll: true }),
        );
    });

    it("queues aligned completion checks from lifecycle-owned layout handling", () => {
        const ctx = createMockContext(
            {},
            {
                initialScroll: { index: 5, viewOffset: 100 } as StateContext["state"]["initialScroll"],
                initialScrollSession: {
                    kind: "bootstrap",
                    previousDataLength: 0,
                } as StateContext["state"]["initialScrollSession"],
                scrollingTo: {
                    animated: false,
                    index: 5,
                    isInitialScroll: true,
                    offset: 220,
                    targetOffset: 220,
                    viewOffset: 0,
                } as StateContext["state"]["scrollingTo"],
                scrollPending: 220,
            },
        );

        handleInitialScrollLayoutReady(ctx);

        expect(checkFinishedScrollSpy).toHaveBeenCalledWith(ctx);
    });
});
