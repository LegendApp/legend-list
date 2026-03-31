import { describe, expect, it, mock } from "bun:test";
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
const scrollTo = mock((_options?: ScrollToOptions) => {});
const schedule = mock(() => true);
const flush = mock(() => {});
const cancel = mock(() => {});
const mockCtx = {
    state: {
        deferredPositions: undefined as { kind?: string } | undefined,
        initialScroll: undefined as { index?: number; contentOffset?: number } | undefined,
        initialScrollLastTarget: undefined as { index?: number; contentOffset?: number } | undefined,
        scrollingTo: undefined as { animated?: boolean; isInitialScroll?: boolean } | undefined,
    },
    values: new Map<string, number>(),
} as any;

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
        scrollTo,
    }),
    resolveWindowScrollTarget: () => ({ left: 0, top: 0 }),
}));

function resetMocks() {
    scrollListeners.clear();
    addEventListener.mockClear();
    removeEventListener.mockClear();
    schedule.mockClear();
    flush.mockClear();
    cancel.mockClear();
    scrollTo.mockClear();
    mockCtx.state.deferredPositions = undefined;
    mockCtx.state.initialScroll = undefined;
    mockCtx.state.initialScrollLastTarget = undefined;
    mockCtx.state.scrollingTo = undefined;
    mockCtx.values.clear();
}

describe("ListComponentScrollView (web)", () => {
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

    it("does not replay stale contentOffset on RAF after core initial scroll takes over", async () => {
        resetMocks();
        const rafCallbacks: FrameRequestCallback[] = [];
        const previousRaf = globalThis.requestAnimationFrame;
        globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
            rafCallbacks.push(cb);
            return rafCallbacks.length as unknown as number;
        }) as typeof requestAnimationFrame;

        const { ListComponentScrollView } = await import(
            "../../src/components/ListComponentScrollView?web-initial-scroll-content-offset-handoff"
        );
        let renderer: TestRenderer.ReactTestRenderer | undefined;

        try {
            act(() => {
                renderer = TestRenderer.create(
                    <ListComponentScrollView
                        contentOffset={{ x: 0, y: 40000 }}
                        onLayout={() => {}}
                        onScroll={() => {}}
                        style={{}}
                    >
                        <div />
                    </ListComponentScrollView>,
                );
            });

            expect(scrollTo).toHaveBeenCalledTimes(1);

            mockCtx.state.scrollingTo = { animated: false, isInitialScroll: true };

            act(() => {
                for (const cb of rafCallbacks.splice(0)) {
                    cb(0);
                }
            });

            expect(scrollTo).toHaveBeenCalledTimes(1);
        } finally {
            globalThis.requestAnimationFrame = previousRaf;
            act(() => {
                renderer?.unmount();
            });
        }
    });

    it("does not replay contentOffset on RAF when an initial scroll target already exists before scrollingTo starts", async () => {
        resetMocks();
        const rafCallbacks: FrameRequestCallback[] = [];
        const previousRaf = globalThis.requestAnimationFrame;
        globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
            rafCallbacks.push(cb);
            return rafCallbacks.length as unknown as number;
        }) as typeof requestAnimationFrame;

        mockCtx.state.initialScroll = { index: 200, contentOffset: 40000 };

        const { ListComponentScrollView } = await import(
            "../../src/components/ListComponentScrollView?web-initial-scroll-active-target-handoff"
        );
        let renderer: TestRenderer.ReactTestRenderer | undefined;

        try {
            act(() => {
                renderer = TestRenderer.create(
                    <ListComponentScrollView
                        contentOffset={{ x: 0, y: 40000 }}
                        onLayout={() => {}}
                        onScroll={() => {}}
                        style={{}}
                    >
                        <div />
                    </ListComponentScrollView>,
                );
            });

            expect(scrollTo).toHaveBeenCalledTimes(1);

            act(() => {
                for (const cb of rafCallbacks.splice(0)) {
                    cb(0);
                }
            });

            expect(scrollTo).toHaveBeenCalledTimes(1);
        } finally {
            globalThis.requestAnimationFrame = previousRaf;
            act(() => {
                renderer?.unmount();
            });
        }
    });
});
