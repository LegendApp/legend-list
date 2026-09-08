import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { cancelImperativeScroll } from "../../src/core/cancelImperativeScroll";
import { doMaintainScrollAtEnd } from "../../src/core/doMaintainScrollAtEnd";
import { finishScrollTo } from "../../src/core/finishScrollTo";
import { set$ } from "../../src/state/state";
import { createImperativeHandle } from "../../src/utils/createImperativeHandle";
import { createMockContext } from "../__mocks__/createMockContext";

describe("end following while an imperative request waits for layout", () => {
    const originalRAF = globalThis.requestAnimationFrame;
    let frames: FrameRequestCallback[];
    let ctx: ReturnType<typeof createMockContext>;
    let follow: ReturnType<typeof mock>;

    beforeEach(() => {
        frames = [];
        globalThis.requestAnimationFrame = (callback) => {
            frames.push(callback);
            return frames.length;
        };
        ctx = createMockContext(
            { readyToRender: true, totalSize: 1000 },
            {
                didContainersLayout: true,
                didFinishInitialScroll: true,
                isWithinMaintainScrollAtEndThreshold: true,
                props: { data: [{ id: "a" }, { id: "b" }], maintainScrollAtEnd: true },
                scroll: 700,
                scrollLength: 300,
            },
        );
        ctx.state.refScroller = {
            current: { getScrollableNode: () => ({}), scrollTo: mock(() => {}) },
        } as any;
        follow = mock(() => false);
        ctx.scrollToEnd = follow;
    });

    afterEach(() => {
        cancelImperativeScroll(ctx.state);
        ctx.state.scheduledWork.dispose();
        globalThis.requestAnimationFrame = originalRAF;
    });

    const flushFrame = async () => {
        for (const callback of frames.splice(0)) {
            callback(0);
        }
        await Promise.resolve();
    };

    for (const supersedesEnd of [false, true]) {
        it(`does not replay end following after a deferred history request (supersedes end: ${supersedesEnd})`, async () => {
            if (supersedesEnd) {
                ctx.state.scrollingTo = { animated: true, isScrollToEnd: true, offset: 700 };
            }
            ctx.state.didDataChange = true;
            const request = createImperativeHandle(ctx).scrollToOffset({ animated: false, offset: 100 });
            expect(ctx.state.scrollingTo?.offset).not.toBe(100);

            doMaintainScrollAtEnd(ctx);
            ctx.state.didDataChange = false;
            await flushFrame();
            await flushFrame();
            expect(ctx.state.scrollingTo?.offset).toBe(100);

            finishScrollTo(ctx);
            await request;
            await flushFrame();
            expect(follow).not.toHaveBeenCalled();
            expect(ctx.state.pendingMaintainScrollAtEnd).toBe(false);
            expect(ctx.state.maintainingScrollAtEnd).toBeUndefined();
        });
    }

    it("keeps a waiting history request owned when the previous end scroll finishes", async () => {
        ctx.state.scrollingTo = { animated: true, isScrollToEnd: true, offset: 700 };
        ctx.state.didDataChange = true;
        const resolved = mock(() => {});
        const request = createImperativeHandle(ctx).scrollToOffset({ animated: false, offset: 100 }).then(resolved);

        finishScrollTo(ctx);
        await Promise.resolve();
        expect(resolved).not.toHaveBeenCalled();
        doMaintainScrollAtEnd(ctx);
        expect(ctx.state.pendingMaintainScrollAtEnd).toBe(false);

        ctx.state.didDataChange = false;
        await flushFrame();
        await flushFrame();
        expect(ctx.state.scrollingTo?.offset).toBe(100);
        finishScrollTo(ctx);
        await request;
        await flushFrame();
        expect(resolved).toHaveBeenCalledTimes(1);
        expect(follow).not.toHaveBeenCalled();
    });

    it("uses the latest end after waiting, then replays growth during the active end scroll", async () => {
        ctx.state.props.getFixedItemSize = () => 500;
        const request = createImperativeHandle(ctx, () => {}).scrollToEnd({ animated: false });
        doMaintainScrollAtEnd(ctx);
        expect(ctx.state.pendingMaintainScrollAtEnd).toBe(false);

        ctx.state.didDataChange = true;
        ctx.state.runPendingScrollToEnd?.();
        ctx.state.props.data = [...ctx.state.props.data, { id: "c" }];
        ctx.state.positions = [0, 500, 1000];
        set$(ctx, "totalSize", 1500);
        doMaintainScrollAtEnd(ctx);
        expect(ctx.state.pendingMaintainScrollAtEnd).toBe(false);

        ctx.state.didDataChange = false;
        await flushFrame();
        await flushFrame();
        expect(ctx.state.scrollingTo?.index).toBe(2);
        expect(ctx.state.scrollingTo?.targetOffset).toBe(1200);
        expect(ctx.state.scrollingTo?.isScrollToEnd).toBe(true);
        expect(follow).not.toHaveBeenCalled();

        doMaintainScrollAtEnd(ctx);
        expect(ctx.state.pendingMaintainScrollAtEnd).toBe(true);
        finishScrollTo(ctx);
        await request;
        await flushFrame();
        expect(follow).toHaveBeenCalledTimes(1);
    });

    it("allows automatic following again after a waiting request is canceled", async () => {
        ctx.state.didDataChange = true;
        const request = createImperativeHandle(ctx).scrollToOffset({ animated: false, offset: 100 });
        doMaintainScrollAtEnd(ctx);
        cancelImperativeScroll(ctx.state);
        await request;

        ctx.state.didDataChange = false;
        doMaintainScrollAtEnd(ctx);
        await flushFrame();
        expect(follow).toHaveBeenCalledTimes(1);
    });
});
