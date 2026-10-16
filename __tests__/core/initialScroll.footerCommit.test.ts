import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import "../setup";

import { handleBootstrapInitialScrollFooterLayout } from "../../src/core/bootstrapInitialScroll";
import { advanceCurrentInitialScrollSession } from "../../src/core/initialScroll";
import { Platform } from "../../src/platform/Platform";
import { createMockContext } from "../__mocks__/createMockContext";

describe("footer commit during the final initial end scroll", () => {
    const originalPlatform = Platform.OS;
    let ctx: ReturnType<typeof createMockContext>;
    let observed: number;
    let scroll: ReturnType<typeof mock>;

    beforeEach(() => {
        Platform.OS = "web";
        const data = Array.from({ length: 7 }, (_, index) => ({ id: String(index) }));
        observed = 400;
        scroll = mock(({ y }: { y: number }) => {
            observed = y;
        });
        ctx = createMockContext(
            { footerSize: 50, readyToRender: false, totalSize: 700 },
            {
                didContainersLayout: true,
                didFinishInitialScroll: false,
                hasScrolled: true,
                idCache: data.map((item) => item.id),
                initialScroll: {
                    contentOffset: 450,
                    index: 6,
                    preserveForBottomPadding: true,
                    preserveForFooterLayout: false,
                    viewOffset: -50,
                    viewPosition: 1,
                },
                initialScrollSession: { kind: "bootstrap", previousDataLength: 7 },
                positions: data.map((_, index) => index * 100),
                props: { data, estimatedItemSize: 100 },
                queuedInitialLayout: true,
                scroll: 450,
                scrollingTo: {
                    animated: false,
                    index: 6,
                    isInitialScroll: true,
                    itemSize: 100,
                    offset: 450,
                    targetOffset: 450,
                    viewOffset: -50,
                    viewPosition: 1,
                },
                scrollLength: 300,
                scrollPending: 450,
                sizes: new Map(data.map((item) => [item.id, 100])),
                sizesKnown: new Map(data.map((item) => [item.id, 100])),
                totalSize: 700,
            },
        );
        ctx.state.refScroller = {
            current: {
                getCurrentScrollOffset: () => observed,
                getMaxScrollOffset: () => 450,
                getScrollableNode: () => ({}),
                scrollTo: scroll,
            },
        } as any;
    });

    afterEach(() => {
        ctx.state.scheduledWork.dispose();
        Platform.OS = originalPlatform;
    });

    it("retries after the real footer extent grows even if cached offsets already equal the target", () => {
        handleBootstrapInitialScrollFooterLayout(ctx, {
            dataLength: 7,
            footerSize: 50,
            initialScrollAtEnd: true,
            stylePaddingEnd: 0,
        });
        expect(scroll).toHaveBeenCalledWith({ animated: false, x: 0, y: 450 });
        expect(observed).toBe(450);
        expect(ctx.state.didFinishInitialScroll).toBe(false);
    });

    it("does not mistake the optimistic cache for the actual web scroll offset", () => {
        expect(advanceCurrentInitialScrollSession(ctx, { forceScroll: true })).toBe(true);
        expect(observed).toBe(450);
    });

    it("does not repeat an already applied initial scroll", () => {
        observed = 450;
        handleBootstrapInitialScrollFooterLayout(ctx, {
            dataLength: 7,
            footerSize: 50,
            initialScrollAtEnd: true,
            stylePaddingEnd: 0,
        });
        expect(scroll).not.toHaveBeenCalled();
    });

    it.each(["negative", "inverted"] as const)("compares logical offsets for horizontal RTL (%s)", (mode) => {
        ctx.state.props.horizontal = true;
        ctx.state.props.rtl = true;
        ctx.state.horizontalRTLScrollType = mode;
        observed = mode === "negative" ? -450 : 0;
        expect(advanceCurrentInitialScrollSession(ctx, { forceScroll: true })).toBe(false);
        expect(scroll).not.toHaveBeenCalled();
    });

    it("does not retarget a history landing when the footer changes", () => {
        ctx.state.initialScroll = { contentOffset: 200, index: 2 };
        ctx.state.scrollingTo = { animated: false, index: 2, isInitialScroll: true, offset: 200, targetOffset: 200 };
        handleBootstrapInitialScrollFooterLayout(ctx, {
            dataLength: 7,
            footerSize: 50,
            initialScrollAtEnd: false,
            stylePaddingEnd: 0,
        });
        expect(scroll).not.toHaveBeenCalled();
    });

    it("also corrects an explicit initial index targeting the last item's end", () => {
        handleBootstrapInitialScrollFooterLayout(ctx, {
            dataLength: 7,
            footerSize: 50,
            initialScrollAtEnd: false,
            stylePaddingEnd: 0,
        });
        expect(observed).toBe(450);
        expect(ctx.state.initialScroll?.index).toBe(6);
    });

    it("leaves an empty dataset alone even if an older final scroll is still present", () => {
        handleBootstrapInitialScrollFooterLayout(ctx, {
            dataLength: 0,
            footerSize: 50,
            initialScrollAtEnd: true,
            stylePaddingEnd: 0,
        });
        expect(scroll).not.toHaveBeenCalled();
    });

    it("does not replace an offset-based initial scroll with an end target", () => {
        ctx.state.initialScrollSession = { kind: "offset" };
        handleBootstrapInitialScrollFooterLayout(ctx, {
            dataLength: 7,
            footerSize: 50,
            initialScrollAtEnd: true,
            stylePaddingEnd: 0,
        });
        expect(scroll).not.toHaveBeenCalled();
    });

    it.each([0, 16, 120])("retargets a committed footer of %ipx during final initial scrolling", (footerSize) => {
        ctx.values.set("footerSize", footerSize);
        handleBootstrapInitialScrollFooterLayout(ctx, {
            dataLength: 7,
            footerSize,
            initialScrollAtEnd: true,
            stylePaddingEnd: 0,
        });
        expect(observed).toBe(400 + footerSize);
        expect(ctx.state.initialScroll?.viewOffset).toBe(-footerSize);
    });

    it("does not pull a finished reader back to the end for a later footer change", () => {
        ctx.state.didFinishInitialScroll = true;
        ctx.state.scrollingTo = undefined;
        ctx.state.scroll = observed = 200;
        handleBootstrapInitialScrollFooterLayout(ctx, {
            dataLength: 7,
            footerSize: 120,
            initialScrollAtEnd: true,
            stylePaddingEnd: 0,
        });
        expect(scroll).not.toHaveBeenCalled();
        expect(observed).toBe(200);
    });

    it.each(["ios", "android"])("keeps the cached no-op behavior on %s", (platform) => {
        Platform.OS = platform as typeof Platform.OS;
        advanceCurrentInitialScrollSession(ctx, { forceScroll: true });
        expect(scroll).not.toHaveBeenCalled();
    });
});
