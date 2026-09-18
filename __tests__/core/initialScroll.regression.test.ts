import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import { finishScrollTo } from "../../src/core/finishScrollTo";
import "../setup";

import {
    evaluateBootstrapInitialScroll,
    handleBootstrapInitialScrollDataChange,
    handleBootstrapInitialScrollFooterLayout,
    handleBootstrapInitialScrollLayoutChange,
    startBootstrapInitialScrollOnMount,
} from "../../src/core/bootstrapInitialScroll";
import { cancelImperativeScroll } from "../../src/core/cancelImperativeScroll";
import { doScrollTo as doNativeScrollTo } from "../../src/core/doScrollTo.native";
import { finishInitialScroll, supersedeInitialScroll } from "../../src/core/finishInitialScroll";
import { resolveInitialScrollOffset, setInitialScrollTarget } from "../../src/core/initialScroll";
import {
    clearFinishedBootstrapInitialScrollTargetIfMovedAway,
    schedulePreservedEndAnchorCorrection,
} from "../../src/core/initialScrollAnchor";
import { onScroll } from "../../src/core/onScroll";
import { scrollTo } from "../../src/core/scrollTo";
import { Platform } from "../../src/platform/Platform";
import type { StateContext } from "../../src/state/state";
import { createMockContext } from "../__mocks__/createMockContext";
import { setLayoutValue } from "../helpers/layoutStore";

// Advance actual scheduled work one frame at a time; a timeout cannot silently
// turn a failed convergence assertion into a successful initialization.
let frames: Map<number, FrameRequestCallback>;
let nextHandle: number;
let timeouts: Map<number, { callback: () => void; delay: number }>;
let originalTimeout: typeof setTimeout;
let originalClearTimeout: typeof clearTimeout;
let originalFrame: typeof requestAnimationFrame;
let originalCancel: typeof cancelAnimationFrame;
let originalPlatform: typeof Platform.OS;
const contexts: StateContext[] = [];

function frame() {
    const pending = [...frames];
    frames.clear();
    for (const [, callback] of pending) callback(0);
}

function fixture() {
    const data = Array.from({ length: 8 }, (_, index) => ({ id: `row-${index}` }));
    const ctx = createMockContext(
        { readyToRender: false, totalSize: 800 },
        {
            containerItemKeys: new Map(data.map((item, index) => [item.id, index])),
            didContainersLayout: true,
            didFinishInitialScroll: false,
            endBuffered: 6,
            idCache: data.map((item) => item.id),
            indexByKey: new Map(data.map((item, index) => [item.id, index])),
            initialScroll: {
                contentOffset: 500,
                index: 5,
                kind: "index",
                previousDataLength: data.length,
                viewOffset: 0,
            },

            lastLayout: { height: 200, width: 320, x: 0, y: 0 },
            positions: data.map((_, index) => index * 100),
            props: { data, estimatedItemSize: 100, keyExtractor: (item: { id: string }) => item.id },
            scroll: 500,
            scrollLength: 200,
            scrollPending: 500,
            sizes: new Map(data.map((item) => [item.id, 100])),
            sizesKnown: new Map(data.map((item) => [item.id, 100])),
            startBuffered: 5,
            totalSize: 800,
        },
    );
    ctx.state.refScroller.current = {
        getCurrentScrollOffset: () => ctx.state.scroll,
        getScrollableNode: () => ({}),
        scrollTo: mock(() => {}),
    } as any;
    ctx.state.triggerCalculateItemsInView = mock(() => evaluateBootstrapInitialScroll(ctx));
    contexts.push(ctx);
    return ctx;
}

beforeEach(() => {
    frames = new Map();
    timeouts = new Map();
    originalTimeout = globalThis.setTimeout;
    originalClearTimeout = globalThis.clearTimeout;
    globalThis.setTimeout = ((callback: () => void, delay: number) => {
        timeouts.set(++nextHandle, { callback, delay });
        return nextHandle;
    }) as typeof setTimeout;
    globalThis.clearTimeout = ((handle: number) => timeouts.delete(handle)) as typeof clearTimeout;
    nextHandle = 0;
    originalFrame = globalThis.requestAnimationFrame;
    originalCancel = globalThis.cancelAnimationFrame;
    originalPlatform = Platform.OS;
    Platform.OS = "ios";
    globalThis.requestAnimationFrame = (callback) => {
        frames.set(++nextHandle, callback);
        return nextHandle;
    };
    globalThis.cancelAnimationFrame = (handle) => {
        frames.delete(handle);
    };
});

afterEach(() => {
    for (const ctx of contexts.splice(0)) ctx.state.scheduledWork.dispose();
    globalThis.setTimeout = originalTimeout;
    globalThis.clearTimeout = originalClearTimeout;
    globalThis.requestAnimationFrame = originalFrame;
    globalThis.cancelAnimationFrame = originalCancel;
    Platform.OS = originalPlatform;
});

describe("initial scroll callback ownership", () => {
    it.each(["bootstrap", "completion", "alignment"] as const)("cancels %s work on unmount", (phase) => {
        const ctx = fixture();
        const finished = mock(() => {});
        if (phase === "bootstrap") {
            startBootstrapInitialScrollOnMount(ctx, { initialScrollAtEnd: false, target: ctx.state.initialScroll! });
            evaluateBootstrapInitialScroll(ctx);
        } else if (phase === "completion") {
            finishInitialScroll(ctx, { onFinished: finished, waitForCompletionFrame: true });
        } else {
            ctx.state.didFinishInitialScroll = true;
            ctx.state.initialScroll!.viewPosition = 1;
            ctx.state.initialScrollAnchor = ctx.state.initialScroll;
            ctx.state.initialScroll = undefined;
            ctx.state.lastNativeScroll = 500;
            ctx.state.scrollLength = 150;
            schedulePreservedEndAnchorCorrection(ctx);
        }
        cancelImperativeScroll(ctx.state);
        ctx.state.scheduledWork.dispose();
        ctx.state.refScroller.current = null;
        expect(frames.size).toBe(0);
        frame();
        expect(finished).not.toHaveBeenCalled();
    });

    it("does not finish a replacement target from an old completion frame", () => {
        const ctx = fixture();
        const finished = mock(() => {});
        finishInitialScroll(ctx, { onFinished: finished, waitForCompletionFrame: true });
        setInitialScrollTarget(ctx, { index: 2, viewOffset: 12 }, { resetDidFinish: true });
        frame();
        expect((ctx.state.initialScroll ?? ctx.state.initialScrollAnchor)?.index).toBe(2);
        expect(ctx.state.didFinishInitialScroll).toBe(false);
        expect(finished).not.toHaveBeenCalled();
    });

    it("does not run an initial completion after imperative supersession", () => {
        const ctx = fixture();
        const finished = mock(() => {});
        finishInitialScroll(ctx, { onFinished: finished, waitForCompletionFrame: true });
        supersedeInitialScroll(ctx);
        ctx.state.scrollingTo = { animated: true, offset: 200 };
        frame();
        expect(ctx.state.scrollingTo?.offset).toBe(200);
        expect(finished).not.toHaveBeenCalled();
        expect(frames.size).toBe(0);
    });

    it("coalesces repeated layout changes into one reevaluation", () => {
        const ctx = fixture();
        startBootstrapInitialScrollOnMount(ctx, { initialScrollAtEnd: false, target: ctx.state.initialScroll! });
        for (let i = 0; i < 4; i++) handleBootstrapInitialScrollLayoutChange(ctx);
        expect(frames.size).toBe(1);
        frame();
        expect(ctx.state.triggerCalculateItemsInView).toHaveBeenCalledTimes(1);
    });
});

describe("initial scroll convergence", () => {
    it.each(["ios", "android", "web"] as const)("converges on %s before fallback", (platform) => {
        Platform.OS = platform;
        const ctx = fixture();
        const warn = mock(() => {});
        const originalWarn = console.warn;
        console.warn = warn;
        try {
            startBootstrapInitialScrollOnMount(ctx, { initialScrollAtEnd: false, target: ctx.state.initialScroll! });
            evaluateBootstrapInitialScroll(ctx);
            expect(ctx.state.didFinishInitialScroll).toBe(false);
            frame();
            expect(warn).not.toHaveBeenCalled();
            if (platform === "ios") {
                expect(ctx.state.didFinishInitialScroll).toBe(true);
                expect(ctx.state.refScroller.current!.scrollTo).not.toHaveBeenCalled();
            } else {
                expect(ctx.state.scrollingTo?.targetOffset).toBe(500);
                expect(ctx.state.refScroller.current!.scrollTo).toHaveBeenCalledTimes(1);
            }
        } finally {
            console.warn = originalWarn;
        }
    });

    it("waits for newly visible measurements after a target moves", () => {
        const ctx = fixture();
        startBootstrapInitialScrollOnMount(ctx, { initialScrollAtEnd: false, target: ctx.state.initialScroll! });
        evaluateBootstrapInitialScroll(ctx);
        ctx.state.sizesKnown.delete("row-6");
        setLayoutValue(ctx.state, "positions", 5, 450);
        setLayoutValue(ctx.state, "positions", 6, 550);
        frame();
        expect(ctx.state.didFinishInitialScroll).toBe(false);
        ctx.state.sizesKnown.set("row-6", 100);
        ctx.state.scroll = 450;
        evaluateBootstrapInitialScroll(ctx);
        expect(ctx.state.scrollingTo?.targetOffset ?? ctx.state.scroll).toBe(450);
    });

    it("bounds convergence when measurements never arrive", () => {
        const ctx = fixture();
        ctx.state.sizesKnown.clear();
        const warn = mock(() => {});
        const originalWarn = console.warn;
        console.warn = warn;
        try {
            startBootstrapInitialScrollOnMount(ctx, { initialScrollAtEnd: false, target: ctx.state.initialScroll! });
            evaluateBootstrapInitialScroll(ctx);
            for (let i = 0; i < 8; i++) frame();
            expect(warn).toHaveBeenCalledTimes(1);
            expect(ctx.state.scrollingTo?.targetOffset).toBe(500);
            expect(ctx.state.refScroller.current!.scrollTo).toHaveBeenCalledTimes(1);
        } finally {
            console.warn = originalWarn;
        }
    });
});

describe("initial target geometry", () => {
    it.each([
        ["origin", 0, 0, 0, 0],
        ["index", 5, 0, 0, 500],
        ["center", 5, 0.5, 0, 450],
        ["bottom", 5, 1, 0, 400],
        ["explicit offset", 5, 1, 17, 383],
        ["negative offset", 5, 1, -17, 417],
        ["tail clamp", 7, 0, 0, 600],
    ] as const)("resolves %s identically on either axis", (_, index, viewPosition, viewOffset, expected) => {
        for (const horizontal of [false, true]) {
            const ctx = fixture();
            ctx.state.props.horizontal = horizontal;
            expect(resolveInitialScrollOffset(ctx, { index, viewOffset, viewPosition })).toBe(expected);
        }
    });

    it("keeps absolute offsets independent of header, footer, padding and insets", () => {
        const ctx = fixture();
        ctx.state.initialScroll = { ...ctx.state.initialScroll, kind: "offset", previousDataLength: 8 };
        ctx.values.set("headerSize", 60);
        ctx.values.set("footerSize", 40);
        ctx.values.set("stylePaddingTop", 20);
        ctx.state.props.stylePaddingBottom = 30;
        expect(resolveInitialScrollOffset(ctx, { contentOffset: 1200 } as any)).toBe(1200);
    });
});

describe("initial scroll layout ownership", () => {
    it("converges using item coordinates when a header precedes the viewport", () => {
        const ctx = fixture();
        ctx.values.set("headerSize", 200);
        ctx.state.scroll = 700;
        ctx.state.scrollPending = 700;
        ctx.state.sizesKnown = new Map([
            ["row-5", 100],
            ["row-6", 100],
        ]);
        startBootstrapInitialScrollOnMount(ctx, { initialScrollAtEnd: false, target: ctx.state.initialScroll! });
        evaluateBootstrapInitialScroll(ctx);
        frame();
        expect(ctx.state.didFinishInitialScroll).toBe(true);
        expect(ctx.state.scroll).toBe(700);
    });

    it("keeps an already revealed list visible during late footer alignment", () => {
        const ctx = fixture();
        ctx.values.set("footerSize", 20);
        ctx.state.initialScroll = {
            index: 7,
            preserveForBottomPadding: true,
            preserveForFooterLayout: true,
            viewOffset: -20,
            viewPosition: 1,
        };
        ctx.state.scroll = resolveInitialScrollOffset(ctx, ctx.state.initialScroll);
        ctx.state.scrollPending = ctx.state.scroll;
        finishInitialScroll(ctx, { preserveTarget: true });
        expect(ctx.values.get("readyToRender")).toBe(true);
        handleBootstrapInitialScrollFooterLayout(ctx, {
            dataLength: 8,
            footerSize: 40,
            initialScrollAtEnd: true,
            stylePaddingEnd: 0,
        });
        expect(ctx.values.get("readyToRender")).toBe(true);
        expect(ctx.state.didFinishInitialScroll).toBe(true);
    });
});

describe("explicit end target geometry", () => {
    it.each([false, true])("includes each header, footer, padding and inset once (horizontal=%s)", (horizontal) => {
        const ctx = fixture();
        ctx.state.props.horizontal = horizontal;
        ctx.values.set("headerSize", 60);
        ctx.values.set("footerSize", 40);
        ctx.values.set("stylePaddingTop", 20);
        ctx.state.props.stylePaddingLeft = 20;
        ctx.state.props.stylePaddingRight = 30;
        ctx.state.props.stylePaddingBottom = 30;
        const target = { index: 7, kind: "end", viewPosition: 1 } as any;
        expect(resolveInitialScrollOffset(ctx, target)).toBe(750);
        ctx.values.set("footerSize", 70);
        expect(resolveInitialScrollOffset(ctx, target)).toBe(780);
        ctx.state.scrollLength = 250;
        expect(resolveInitialScrollOffset(ctx, target)).toBe(730);
    });
});

it("settles the scroll promise when unmounted during deferred reveal", () => {
    const ctx = fixture();
    const resolve = mock(() => {});
    ctx.state.pendingScrollResolve = resolve;
    ctx.state.scrollingTo = { isInitialScroll: true, offset: 500, waitForInitialScrollCompletionFrame: true };
    finishScrollTo(ctx);
    expect(resolve).not.toHaveBeenCalled();
    cancelImperativeScroll(ctx.state);
    ctx.state.scheduledWork.dispose();
    expect(resolve).toHaveBeenCalledTimes(1);
});

it.each(["footer", "padding", "data"] as const)("corrects a revealed end anchor after %s changes", (change) => {
    const ctx = fixture();
    ctx.state.scrollAdjustHandler.requestAdjust = mock(() => {});
    ctx.state.initialScroll = { index: 7, kind: "end", preserveForFooterLayout: true, viewPosition: 1 };
    ctx.state.scroll = 600;
    ctx.state.scrollPending = 600;
    finishInitialScroll(ctx, { preserveTarget: true });
    if (change === "footer") {
        ctx.values.set("footerSize", 40);
        handleBootstrapInitialScrollFooterLayout(ctx, {
            dataLength: 8,
            footerSize: 40,
            initialScrollAtEnd: true,
            stylePaddingEnd: 0,
        });
    } else if (change === "padding") {
        ctx.state.props.stylePaddingBottom = 40;
        handleBootstrapInitialScrollDataChange(ctx, {
            dataLength: 8,
            didDataChange: false,
            initialScrollAtEnd: true,
            previousDataLength: 8,
            stylePaddingEnd: 40,
        });
    } else {
        ctx.state.props.data = [...ctx.state.props.data, { id: "row-8" }];
        ctx.state.totalSize = 900;
        handleBootstrapInitialScrollDataChange(ctx, {
            dataLength: 9,
            didDataChange: true,
            initialScrollAtEnd: true,
            previousDataLength: 8,
            stylePaddingEnd: 0,
        });
    }
    frame();
    expect(ctx.state.scrollAdjustHandler.requestAdjust).toHaveBeenCalledWith(change === "data" ? 100 : 40);
    expect(ctx.state.initialScroll).toBeUndefined();
    expect(ctx.state.didFinishInitialScroll).toBe(true);
    expect(ctx.values.get("readyToRender")).toBe(true);
});

it.each(["web", "native"] as const)(
    "does not recreate initialization for a completed %s corrective dispatch",
    (platform) => {
        const ctx = fixture();
        finishInitialScroll(ctx);
        if (platform === "native") doNativeScrollTo(ctx, { isInitialScroll: true, offset: 200 });
        else scrollTo(ctx, { forceScroll: true, isInitialScroll: true, noScrollingTo: true, offset: 200 });
        expect(ctx.state.initialScroll).toBeUndefined();
        expect(ctx.state.didFinishInitialScroll).toBe(true);
    },
);

it("keeps correcting an end footer that measures more than once after reveal", () => {
    const ctx = fixture();
    const requested: number[] = [];
    ctx.state.scrollAdjustHandler.requestAdjust = (delta) => requested.push(delta);
    ctx.state.initialScroll = { index: 7, kind: "end", preserveForFooterLayout: true, viewPosition: 1 };
    ctx.state.scroll = ctx.state.scrollPending = 600;
    finishInitialScroll(ctx, { preserveTarget: true });
    for (const footerSize of [40, 80]) {
        ctx.values.set("footerSize", footerSize);
        handleBootstrapInitialScrollFooterLayout(ctx, {
            dataLength: 8,
            footerSize,
            initialScrollAtEnd: true,
            stylePaddingEnd: 0,
        });
        frame();
        ctx.state.lastNativeScroll = ctx.state.scroll;
        ctx.state.lastNativeScrollTime = ctx.state.initialScrollAnchor!.lastRequestTime! + 1;
        ctx.state.scrollPending = ctx.state.scroll;
        frame();
    }
    expect(requested).toEqual([40, 40]);
    expect(ctx.state.scroll).toBe(680);
    expect(ctx.values.get("readyToRender")).toBe(true);
});

function revealedEnd() {
    const ctx = fixture();
    ctx.state.initialScroll = { index: 7, kind: "end", preserveForBottomPadding: true, viewPosition: 1 };
    ctx.state.scroll = ctx.state.scrollPending = 600;
    ctx.state.lastNativeScroll = 600;
    ctx.state.scrollAdjustHandler.requestAdjust = mock(() => {});
    finishInitialScroll(ctx, { preserveTarget: true });
    frame();
    return ctx;
}

function footerLayout(ctx: StateContext, footerSize: number) {
    ctx.values.set("footerSize", footerSize);
    handleBootstrapInitialScrollFooterLayout(ctx, {
        dataLength: ctx.state.props.data.length,
        footerSize,
        initialScrollAtEnd: true,
        stylePaddingEnd: 0,
    });
}

describe("post-reveal native observations", () => {
    it.each(["ios", "android", "web"] as const)("waits for acknowledgement before retrying on %s", (platform) => {
        Platform.OS = platform;
        const ctx = revealedEnd();
        footerLayout(ctx, 40);
        frame();
        for (let i = 0; i < 4; i++) frame();
        expect(ctx.state.scrollAdjustHandler.requestAdjust).toHaveBeenCalledTimes(1);
        expect(ctx.state.scroll).toBe(640);

        // A later observation confirms that the platform applied only part of the correction.
        ctx.state.lastNativeScroll = 620;
        ctx.state.lastNativeScrollTime = ctx.state.initialScrollAnchor!.lastRequestTime! + 1;
        ctx.state.scroll = ctx.state.scrollPending = 620;
        frame();
        expect(ctx.state.scrollAdjustHandler.requestAdjust).toHaveBeenLastCalledWith(20);
        expect(ctx.state.scrollAdjustHandler.requestAdjust).toHaveBeenCalledTimes(2);
        ctx.state.lastNativeScroll = 640;
        frame();
        expect(frames.size).toBe(0);
        expect(ctx.state.initialScroll).toBeUndefined();
        expect(ctx.values.get("readyToRender")).toBe(true);
    });

    it.each([-0.9, 0, 0.9])("accepts subpixel alignment error %s without corrective scrolling", (error) => {
        const ctx = revealedEnd();
        ctx.state.lastNativeScroll = 640 + error;
        footerLayout(ctx, 40);
        frame();
        expect(ctx.state.scrollAdjustHandler.requestAdjust).not.toHaveBeenCalled();
        expect(frames.size).toBe(0);
    });

    it("coalesces several footer measurements before dispatch into the final geometry", () => {
        const ctx = revealedEnd();
        for (const size of [20, 80, 40]) footerLayout(ctx, size);
        expect(frames.size).toBe(1);
        frame();
        expect(ctx.state.scrollAdjustHandler.requestAdjust).toHaveBeenCalledTimes(1);
        expect(ctx.state.scrollAdjustHandler.requestAdjust).toHaveBeenCalledWith(40);
    });

    it("combines viewport shrink and footer growth into one correction", () => {
        const ctx = revealedEnd();
        ctx.state.scrollLength = 150;
        handleBootstrapInitialScrollLayoutChange(ctx);
        footerLayout(ctx, 40);
        frame();
        expect(ctx.state.scrollAdjustHandler.requestAdjust).toHaveBeenCalledTimes(1);
        expect(ctx.state.scrollAdjustHandler.requestAdjust).toHaveBeenCalledWith(90);
        expect(ctx.values.get("readyToRender")).toBe(true);
    });

    it("corrects negative deltas when the viewport grows", () => {
        const ctx = revealedEnd();
        ctx.state.scrollLength = 300;
        handleBootstrapInitialScrollLayoutChange(ctx);
        frame();
        expect(ctx.state.scrollAdjustHandler.requestAdjust).toHaveBeenCalledTimes(1);
        expect(ctx.state.scrollAdjustHandler.requestAdjust).toHaveBeenCalledWith(-100);
        expect(ctx.state.scroll).toBe(500);
    });
});

describe("post-reveal ownership changes", () => {
    it("cancels queued alignment when an imperative scroll supersedes initialization", () => {
        const ctx = revealedEnd();
        footerLayout(ctx, 40);
        supersedeInitialScroll(ctx);
        ctx.state.scrollingTo = { animated: false, offset: 200 };
        frame();
        expect(ctx.state.scrollAdjustHandler.requestAdjust).not.toHaveBeenCalled();
        expect(ctx.state.initialScrollAnchor).toBeUndefined();
        expect(ctx.state.scrollingTo.offset).toBe(200);
        expect(frames.size).toBe(0);
    });

    it("does not pull a user back after moving away from a settled end", () => {
        const ctx = revealedEnd();
        ctx.state.scroll = ctx.state.scrollPending = ctx.state.lastNativeScroll = 300;
        ctx.values.set("isAtEnd", false);
        clearFinishedBootstrapInitialScrollTargetIfMovedAway(ctx);
        footerLayout(ctx, 40);
        frame();
        expect(ctx.state.initialScrollAnchor).toBeUndefined();
        expect(ctx.state.scrollAdjustHandler.requestAdjust).not.toHaveBeenCalled();
        expect(ctx.state.scroll).toBe(300);
    });

    it("drops a numeric bottom target on data replacement without following the new end", () => {
        const ctx = revealedEnd();
        ctx.state.initialScrollAnchor!.kind = "index";
        footerLayout(ctx, 40);
        handleBootstrapInitialScrollDataChange(ctx, {
            dataLength: 8,
            didDataChange: true,
            initialScrollAtEnd: false,
            previousDataLength: 8,
            stylePaddingEnd: 0,
        });
        frame();
        expect(ctx.state.initialScrollAnchor).toBeUndefined();
        expect(ctx.state.scrollAdjustHandler.requestAdjust).not.toHaveBeenCalled();
    });

    it("does not schedule an end adjustment for empty data", () => {
        const ctx = revealedEnd();
        ctx.state.props.data = [];
        expect(schedulePreservedEndAnchorCorrection(ctx)).toBe(false);
        expect(frames.size).toBe(0);
    });

    it("does not schedule alignment while an imperative target owns scrolling", () => {
        const ctx = revealedEnd();
        ctx.state.scrollingTo = { animated: true, offset: 100 };
        expect(schedulePreservedEndAnchorCorrection(ctx)).toBe(false);
        expect(frames.size).toBe(0);
    });
});

describe("bootstrap replacement during pending work", () => {
    it.each(["ios", "android", "web"] as const)("dispatches only the replacement target on %s", (platform) => {
        Platform.OS = platform;
        const ctx = fixture();
        startBootstrapInitialScrollOnMount(ctx, { initialScrollAtEnd: false, target: ctx.state.initialScroll! });
        evaluateBootstrapInitialScroll(ctx);
        setInitialScrollTarget(ctx, { index: 2 }, { resetDidFinish: true });
        ctx.state.startBuffered = 2;
        ctx.state.endBuffered = 3;
        startBootstrapInitialScrollOnMount(ctx, { initialScrollAtEnd: false, target: ctx.state.initialScroll! });
        evaluateBootstrapInitialScroll(ctx);
        frame();
        expect(ctx.state.scrollingTo?.targetOffset).toBe(200);
        expect(ctx.state.refScroller.current!.scrollTo).toHaveBeenCalledTimes(1);
        expect(ctx.state.initialScroll?.index).toBe(2);
    });
});

it.each(["ios", "android", "web"] as const)(
    "does not duplicate outstanding adjustments after another footer measurement on %s",
    (platform) => {
        Platform.OS = platform;
        const ctx = revealedEnd();
        footerLayout(ctx, 40);
        frame();
        footerLayout(ctx, 80);
        frame();
        expect(ctx.state.scrollAdjustHandler.requestAdjust).toHaveBeenCalledTimes(1);
        expect(ctx.state.scroll).toBe(640);
        ctx.state.lastNativeScroll = 640;
        ctx.state.lastNativeScrollTime = ctx.state.initialScrollAnchor!.lastRequestTime! + 1;
        ctx.state.scroll = ctx.state.scrollPending = 640;
        frame();
        expect(ctx.state.scrollAdjustHandler.requestAdjust).toHaveBeenCalledTimes(2);
        expect(ctx.state.scrollAdjustHandler.requestAdjust).toHaveBeenLastCalledWith(40);
        expect(ctx.state.scroll).toBe(680);
    },
);

it("expires unacknowledged alignment without hiding or resuming initialization", () => {
    const ctx = revealedEnd();
    footerLayout(ctx, 40);
    frame();
    const expiry = [...timeouts.values()].find(({ delay }) => delay === 2000)!;
    expiry.callback();
    frame();
    expect(ctx.state.initialScrollAnchor).toBeUndefined();
    expect(ctx.state.initialScroll).toBeUndefined();
    expect(ctx.values.get("readyToRender")).toBe(true);
    expect(frames.size).toBe(0);
    footerLayout(ctx, 80);
    frame();
    expect(ctx.state.scrollAdjustHandler.requestAdjust).toHaveBeenCalledTimes(1);
});

it("an old expiry callback cannot clear a replacement target's anchor", () => {
    const ctx = revealedEnd();
    const expiry = [...timeouts.values()].find(({ delay }) => delay === 2000)!;
    setInitialScrollTarget(ctx, { index: 3, viewPosition: 1 }, { resetDidFinish: true });
    const cancel = spyOn(ctx.state.scheduledWork, "cancel");
    try {
        finishInitialScroll(ctx, { preserveTarget: true, resolvedOffset: 200 });
        expect(cancel.mock.calls.filter(([key]) => key === "initialScrollAlignment")).toHaveLength(1);
    } finally {
        cancel.mockRestore();
    }
    expiry.callback();
    expect(ctx.state.initialScrollAnchor?.index).toBe(3);
    expect(ctx.state.initialScrollAnchor?.contentOffset).toBe(200);
    expect(ctx.state.scheduledWork.has("preservedInitialScroll")).toBe(true);
    expect(ctx.values.get("readyToRender")).toBe(true);
});

it.each(["end", "index"] as const)(
    "releases a %s footer anchor on the first user scroll before a later resize",
    (kind) => {
        const ctx = revealedEnd();
        ctx.state.initialScrollAnchor!.kind = kind;
        ctx.state.initialScrollAnchor!.preserveForFooterLayout = true;
        ctx.values.set("isAtEnd", false);
        onScroll(ctx, {
            nativeEvent: {
                contentOffset: { x: 0, y: 300 },
                contentSize: { height: 800, width: 320 },
                layoutMeasurement: { height: 200, width: 320 },
            },
        } as any);
        footerLayout(ctx, 80);
        ctx.state.scrollLength = 150;
        handleBootstrapInitialScrollLayoutChange(ctx);
        frame();
        expect(ctx.state.scroll).toBe(300);
        expect(ctx.state.initialScrollAnchor).toBeUndefined();
        expect(ctx.state.scrollAdjustHandler.requestAdjust).not.toHaveBeenCalled();
        expect(ctx.values.get("readyToRender")).toBe(true);
    },
);

it.each(["web"] as const)("releases queued and outstanding end corrections on movement away on %s", (platform) => {
    Platform.OS = platform;
    for (const dispatched of [false, true]) {
        const ctx = revealedEnd();
        footerLayout(ctx, 40);
        if (dispatched) frame();
        const requested = ctx.state.scrollAdjustHandler.requestAdjust as ReturnType<typeof mock>;
        const callsBeforeUserScroll = requested.mock.calls.length;
        ctx.values.set("isAtEnd", false);
        onScroll(ctx, {
            nativeEvent: {
                contentOffset: { x: 0, y: 300 },
                contentSize: { height: 840, width: 320 },
                layoutMeasurement: { height: 200, width: 320 },
            },
        } as any);
        frame();
        expect(requested).toHaveBeenCalledTimes(callsBeforeUserScroll);
        expect(ctx.state.initialScrollAnchor).toBeUndefined();
        expect(ctx.state.scheduledWork.has("initialScrollAlignment")).toBe(false);
        expect(ctx.state.lastNativeScroll).toBe(300);
        expect(ctx.values.get("readyToRender")).toBe(true);
    }
});

it.each([620, 640])("keeps an outstanding correction on native acknowledgement at %s", (offset) => {
    const ctx = revealedEnd();
    footerLayout(ctx, 40);
    frame();
    ctx.values.set("isAtEnd", false);
    onScroll(ctx, {
        nativeEvent: {
            contentOffset: { x: 0, y: offset },
            contentSize: { height: 840, width: 320 },
            layoutMeasurement: { height: 200, width: 320 },
        },
    } as any);
    expect(ctx.state.initialScrollAnchor).toBeDefined();
    ctx.state.lastNativeScrollTime = ctx.state.initialScrollAnchor!.lastRequestTime! + 1;
    frame();
    expect(ctx.state.scrollAdjustHandler.requestAdjust).toHaveBeenCalledTimes(offset === 620 ? 2 : 1);
    if (offset === 620) expect(ctx.state.scrollAdjustHandler.requestAdjust).toHaveBeenLastCalledWith(20);
});

it.each(["ios", "android"] as const)(
    "keeps native resize corrections through clamping and MVCP overshoot on %s",
    (platform) => {
        Platform.OS = platform;
        for (const dispatched of [false, true]) {
            const ctx = revealedEnd();
            ctx.state.scrollLength = 340;
            handleBootstrapInitialScrollLayoutChange(ctx);
            if (dispatched) frame();
            const observed = dispatched ? 320 : 460;
            onScroll(ctx, {
                nativeEvent: {
                    contentOffset: { x: 0, y: observed },
                    contentSize: { height: 800, width: 320 },
                    layoutMeasurement: { height: 340, width: 320 },
                },
            } as any);
            expect(ctx.state.initialScrollAnchor).toBeDefined();
            ctx.state.lastNativeScrollTime = (ctx.state.initialScrollAnchor!.lastRequestTime ?? 0) + 1;
            frame();
            expect(ctx.state.scrollAdjustHandler.requestAdjust).toHaveBeenCalledTimes(dispatched ? 2 : 0);
            if (dispatched) expect(ctx.state.scrollAdjustHandler.requestAdjust).toHaveBeenLastCalledWith(140);
        }
    },
);
