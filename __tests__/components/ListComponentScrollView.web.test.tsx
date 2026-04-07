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
const scrollToTarget = mock((_options?: ScrollToOptions) => {});
const schedule = mock(() => true);
const flush = mock(() => {});
const cancel = mock(() => {});
const mockCtx = {
    state: {
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
        getDocumentMaxOffset: () => 444,
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
            scrollTo: scrollToTarget,
        }),
        resolveWindowScrollTarget: () => ({ left: 0, top: 0 }),
    }));
}

function resetMocks() {
    scrollListeners.clear();
    addEventListener.mockClear();
    removeEventListener.mockClear();
    scrollToTarget.mockClear();
    schedule.mockClear();
    flush.mockClear();
    cancel.mockClear();
    mockCtx.state.scrollingTo = undefined;
}

describe("ListComponentScrollView (web)", () => {
    beforeEach(() => {
        registerWebScrollMocks();
    });

    it("keeps RAF coalescing for animated or absent scroll targets", async () => {
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

            mockCtx.state.scrollingTo = { animated: true };
            act(() => {
                listener?.({} as Event);
            });

            expect(schedule).toHaveBeenCalledTimes(2);
            expect(flush).not.toHaveBeenCalled();
        } finally {
            act(() => {
                renderer?.unmount();
            });
        }
    });

    it("flushes immediately for active non-animated scroll targets", async () => {
        resetMocks();
        mockCtx.state.scrollingTo = { animated: false };
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

    it("scrolls the document to its end for initial window-end requests", async () => {
        resetMocks();
        const ref = { current: null as any };
        const { ListComponentScrollView } = await import(
            "../../src/components/ListComponentScrollView?web-scroll-window-end"
        );
        let renderer: TestRenderer.ReactTestRenderer | undefined;

        try {
            act(() => {
                renderer = TestRenderer.create(
                    <ListComponentScrollView
                        initialScrollAtWindowEnd
                        onLayout={() => {}}
                        ref={ref as any}
                        style={{}}
                        useWindowScroll
                    >
                        <div />
                    </ListComponentScrollView>,
                );
            });

            act(() => {
                ref.current.scrollTo({ animated: false, initialScrollAtWindowEnd: true, y: 120 });
            });

            expect(scrollToTarget).toHaveBeenCalledWith({ behavior: "auto", left: 0, top: 444 });
        } finally {
            act(() => {
                renderer?.unmount();
            });
        }
    });
});
