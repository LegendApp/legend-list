import { beforeEach, describe, expect, it, mock } from "bun:test";
import "../setup";

import TestRenderer, { act } from "../helpers/testRenderer";

type ScrollListener = (_event: Event) => void;

const scrollListeners = new Map<string, ScrollListener>();
const addEventListener = mock((type: string, listener: ScrollListener) => {
    scrollListeners.set(type, listener);
});
const removeEventListener = mock((type: string) => {
    scrollListeners.delete(type);
});
const schedule = mock(() => true);
const flush = mock(() => {});
const cancel = mock(() => {});
const mockCtx = {
    state: {
        dataChangeNeedsScrollUpdate: false,
        didFinishInitialScroll: true,
        initialScroll: undefined as Record<string, unknown> | undefined,
        initialScrollSession: undefined as { kind?: string } | undefined,
        mvcpAnchorLock: undefined as { expiresAt: number } | undefined,
        scrollingTo: undefined as { animated?: boolean } | undefined,
    },
} as any;

function registerWebScrollMocks() {
    mock.module("@/state/state", () => ({
        useStateContext: () => mockCtx,
    }));

    mock.module("@/utils/useRafCoalescer", () => ({
        useRafCoalescer: () => ({
            cancel,
            flush,
            schedule,
        }),
    }));

    mock.module("../../src/components/webScrollUtils", () => ({
        clampOffset: (offset: number) => offset,
        getContentSize: () => ({ height: 0, width: 0 }),
        getElementDocumentPosition: () => ({ left: 0, top: 0 }),
        getLayoutMeasurement: () => ({ height: 0, width: 0 }),
        getLayoutRectangle: () => ({ height: 0, width: 0, x: 0, y: 0 }),
        getMaxOffset: () => 0,
        getScrollContentSize: () => ({ height: 0, width: 0 }),
        getWindowScrollPosition: () => ({ x: 0, y: 0 }),
        resolveScrollableNode: () => null,
        resolveScrollEventTarget: () => ({
            addEventListener,
            removeEventListener,
        }),
        resolveWindowScrollTarget: () => ({ left: 0, top: 0 }),
    }));
}

function resetMocks() {
    scrollListeners.clear();
    addEventListener.mockClear();
    removeEventListener.mockClear();
    schedule.mockClear();
    flush.mockClear();
    cancel.mockClear();
    mockCtx.state.dataChangeNeedsScrollUpdate = false;
    mockCtx.state.didFinishInitialScroll = true;
    mockCtx.state.initialScroll = undefined;
    mockCtx.state.initialScrollSession = undefined;
    mockCtx.state.mvcpAnchorLock = undefined;
    mockCtx.state.scrollingTo = undefined;
}

describe("ListComponentScrollView (web)", () => {
    beforeEach(() => {
        registerWebScrollMocks();
    });

    it("keeps RAF coalescing during steady-state user scrolling", async () => {
        resetMocks();
        const { ListComponentScrollView } = await import(
            "../../src/components/ListComponentScrollView?web-scroll-coalesce"
        );
        let renderer: TestRenderer.ReactTestRenderer | undefined;

        try {
            act(() => {
                renderer = TestRenderer.create(
                    <ListComponentScrollView onLayout={() => {}} onScroll={() => {}} style={{}}>
                        <div />
                    </ListComponentScrollView>,
                );
            });

            expect(addEventListener).toHaveBeenCalledWith("scroll", expect.any(Function), { passive: true });
            const listener = scrollListeners.get("scroll");
            expect(listener).toBeDefined();

            act(() => {
                listener?.({} as Event);
            });

            expect(schedule).toHaveBeenCalledTimes(1);
            expect(flush).not.toHaveBeenCalled();
        } finally {
            act(() => {
                renderer?.unmount();
            });
        }
    });

    it("flushes immediately for any active programmatic scroll target", async () => {
        resetMocks();
        mockCtx.state.scrollingTo = { animated: true };
        const { ListComponentScrollView } = await import(
            "../../src/components/ListComponentScrollView?web-scroll-flush"
        );
        let renderer: TestRenderer.ReactTestRenderer | undefined;

        try {
            act(() => {
                renderer = TestRenderer.create(
                    <ListComponentScrollView onLayout={() => {}} onScroll={() => {}} style={{}}>
                        <div />
                    </ListComponentScrollView>,
                );
            });

            const listener = scrollListeners.get("scroll");
            expect(listener).toBeDefined();

            act(() => {
                listener?.({} as Event);
            });

            expect(flush).toHaveBeenCalledTimes(1);
            expect(schedule).not.toHaveBeenCalled();
        } finally {
            act(() => {
                renderer?.unmount();
            });
        }
    });

    it("flushes immediately while initial scroll is still pending", async () => {
        resetMocks();
        mockCtx.state.didFinishInitialScroll = false;
        mockCtx.state.initialScroll = {};
        mockCtx.state.initialScrollSession = { kind: "bootstrap" };
        const { ListComponentScrollView } = await import(
            "../../src/components/ListComponentScrollView?web-scroll-initial-scroll"
        );
        let renderer: TestRenderer.ReactTestRenderer | undefined;

        try {
            act(() => {
                renderer = TestRenderer.create(
                    <ListComponentScrollView onLayout={() => {}} onScroll={() => {}} style={{}}>
                        <div />
                    </ListComponentScrollView>,
                );
            });

            const listener = scrollListeners.get("scroll");
            expect(listener).toBeDefined();

            act(() => {
                listener?.({} as Event);
            });

            expect(flush).toHaveBeenCalledTimes(1);
            expect(schedule).not.toHaveBeenCalled();
        } finally {
            act(() => {
                renderer?.unmount();
            });
        }
    });

    it("flushes immediately while MVCP is active", async () => {
        resetMocks();
        mockCtx.state.dataChangeNeedsScrollUpdate = true;
        const { ListComponentScrollView } = await import(
            "../../src/components/ListComponentScrollView?web-scroll-mvcp"
        );
        let renderer: TestRenderer.ReactTestRenderer | undefined;

        try {
            act(() => {
                renderer = TestRenderer.create(
                    <ListComponentScrollView onLayout={() => {}} onScroll={() => {}} style={{}}>
                        <div />
                    </ListComponentScrollView>,
                );
            });

            const listener = scrollListeners.get("scroll");
            expect(listener).toBeDefined();

            act(() => {
                listener?.({} as Event);
            });

            expect(flush).toHaveBeenCalledTimes(1);
            expect(schedule).not.toHaveBeenCalled();
        } finally {
            act(() => {
                renderer?.unmount();
            });
        }
    });
});
