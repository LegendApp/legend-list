import { beforeEach, describe, expect, it, mock } from "bun:test";
import "../setup";

import { clearWarnDevOnceForTests } from "../../src/utils/helpers";
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
        anchoredEndSpaceSize: undefined as number | undefined,
        dataChangeNeedsScrollUpdate: false,
        didFinishInitialScroll: true,
        initialScroll: undefined as Record<string, unknown> | undefined,
        initialScrollSession: undefined as { kind?: string } | undefined,
        mvcpAnchorLock: undefined as { expiresAt: number } | undefined,
        props: {
            anchoredEndSpace: undefined as { includeInEndInset?: boolean } | undefined,
            contentInsetEndAdjustment: undefined as number | undefined,
        },
        scrollingTo: undefined as { animated?: boolean } | undefined,
    },
} as any;

function registerWebScrollMocks() {
    mock.module("@/state/state", () => ({
        useArr$: () => [mockCtx.state.anchoredEndSpaceSize],
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
    clearWarnDevOnceForTests();
    scrollListeners.clear();
    addEventListener.mockClear();
    removeEventListener.mockClear();
    schedule.mockClear();
    flush.mockClear();
    cancel.mockClear();
    mockCtx.state.anchoredEndSpaceSize = undefined;
    mockCtx.state.dataChangeNeedsScrollUpdate = false;
    mockCtx.state.didFinishInitialScroll = true;
    mockCtx.state.initialScroll = undefined;
    mockCtx.state.initialScrollSession = undefined;
    mockCtx.state.mvcpAnchorLock = undefined;
    mockCtx.state.props.anchoredEndSpace = undefined;
    mockCtx.state.props.contentInsetEndAdjustment = undefined;
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

    it("applies contentContainerClassName to the inner content div", async () => {
        resetMocks();
        const { ListComponentScrollView } = await import(
            "../../src/components/ListComponentScrollView?web-scroll-content-container-class"
        );
        let renderer: TestRenderer.ReactTestRenderer | undefined;

        try {
            act(() => {
                renderer = TestRenderer.create(
                    <ListComponentScrollView
                        contentContainerClassName="p-4"
                        onLayout={() => {}}
                        onScroll={() => {}}
                        style={{}}
                    >
                        <div />
                    </ListComponentScrollView>,
                );
            });

            const divs = renderer!.root.findAllByType("div");
            expect(divs).toHaveLength(3);
            expect(divs[0]?.props.className).toBeUndefined();
            expect(divs[1]?.props.className).toBe("legend-list-content-container p-4");
        } finally {
            act(() => {
                renderer?.unmount();
            });
        }
    });

    it("warns once when className props include gap utilities", async () => {
        resetMocks();
        const warnSpy = mock(() => {});
        const originalWarn = console.warn;
        console.warn = warnSpy as typeof console.warn;
        const { ListComponentScrollView } = await import(
            "../../src/components/ListComponentScrollView?web-scroll-content-container-gap-warning"
        );
        let renderer: TestRenderer.ReactTestRenderer | undefined;

        try {
            act(() => {
                renderer = TestRenderer.create(
                    <ListComponentScrollView
                        contentContainerClassName="p-4 md:gap-x-4 gap-y-[18px]"
                        onLayout={() => {}}
                        onScroll={() => {}}
                        style={{}}
                    >
                        <div />
                    </ListComponentScrollView>,
                );
            });

            act(() => {
                renderer!.update(
                    <ListComponentScrollView
                        className="scroll-shell gap-4"
                        onLayout={() => {}}
                        onScroll={() => {}}
                        style={{}}
                    >
                        <div />
                    </ListComponentScrollView>,
                );
            });

            expect(warnSpy).toHaveBeenCalledTimes(1);
            expect(warnSpy).toHaveBeenCalledWith(
                "[legend-list] className/contentContainerClassName gap classes are not supported in LegendList because it needs to use exact values internally. Use contentContainerStyle={{ gap: ... }} or columnWrapperStyle instead.",
            );
        } finally {
            console.warn = originalWarn;
            act(() => {
                renderer?.unmount();
            });
        }
    });

    it("does not warn for contentContainerClassName without gap utilities", async () => {
        resetMocks();
        const warnSpy = mock(() => {});
        const originalWarn = console.warn;
        console.warn = warnSpy as typeof console.warn;
        const { ListComponentScrollView } = await import(
            "../../src/components/ListComponentScrollView?web-scroll-content-container-no-gap-warning"
        );
        let renderer: TestRenderer.ReactTestRenderer | undefined;

        try {
            act(() => {
                renderer = TestRenderer.create(
                    <ListComponentScrollView
                        contentContainerClassName="p-4 gapless data-[state=open]:bg-blue-500"
                        onLayout={() => {}}
                        onScroll={() => {}}
                        style={{}}
                    >
                        <div />
                    </ListComponentScrollView>,
                );
            });

            expect(warnSpy).not.toHaveBeenCalled();
        } finally {
            console.warn = originalWarn;
            act(() => {
                renderer?.unmount();
            });
        }
    });

    it("adds the hidden scrollbar class for vertical lists without changing overflow behavior", async () => {
        resetMocks();
        const { ListComponentScrollView } = await import(
            "../../src/components/ListComponentScrollView?web-scroll-hidden-vertical"
        );
        let renderer: TestRenderer.ReactTestRenderer | undefined;

        try {
            act(() => {
                renderer = TestRenderer.create(
                    <ListComponentScrollView
                        className="outer-scroll"
                        onLayout={() => {}}
                        onScroll={() => {}}
                        showsHorizontalScrollIndicator={false}
                        showsVerticalScrollIndicator={false}
                        style={{}}
                    >
                        <div />
                    </ListComponentScrollView>,
                );
            });

            const divs = renderer!.root.findAllByType("div");
            expect(divs[0]?.props.className).toBe("outer-scroll legend-list-scrollbar-y-hidden");
            expect(divs[0]?.props.style.overflowX).toBe("hidden");
            expect(divs[0]?.props.style.overflowY).toBe("auto");
        } finally {
            act(() => {
                renderer?.unmount();
            });
        }
    });

    it("adds the hidden scrollbar class for horizontal lists without changing overflow behavior", async () => {
        resetMocks();
        const { ListComponentScrollView } = await import(
            "../../src/components/ListComponentScrollView?web-scroll-hidden-horizontal"
        );
        let renderer: TestRenderer.ReactTestRenderer | undefined;

        try {
            act(() => {
                renderer = TestRenderer.create(
                    <ListComponentScrollView
                        horizontal
                        onLayout={() => {}}
                        onScroll={() => {}}
                        showsHorizontalScrollIndicator={false}
                        showsVerticalScrollIndicator={false}
                        style={{}}
                    >
                        <div />
                    </ListComponentScrollView>,
                );
            });

            const divs = renderer!.root.findAllByType("div");
            expect(divs[0]?.props.className).toBe("legend-list-scrollbar-x-hidden");
            expect(divs[0]?.props.style.overflowX).toBe("auto");
            expect(divs[0]?.props.style.overflowY).toBe("hidden");
        } finally {
            act(() => {
                renderer?.unmount();
            });
        }
    });

    it("renders complete horizontal CSS snap anchors from snap offsets", async () => {
        resetMocks();
        const { ListComponentScrollView } = await import("../../src/components/ListComponentScrollView?web-snap-x");
        let renderer: TestRenderer.ReactTestRenderer | undefined;

        try {
            act(() => {
                renderer = TestRenderer.create(
                    <ListComponentScrollView
                        horizontal
                        onLayout={() => {}}
                        onScroll={() => {}}
                        snapToOffsets={[0, 296, 592]}
                        style={{}}
                    >
                        <div />
                    </ListComponentScrollView>,
                );
            });

            const divs = renderer!.root.findAllByType("div");
            expect(divs[0]?.props.style.scrollSnapType).toBe("x mandatory");
            expect(divs[2]?.props["data-legend-list-snap-anchor"]).toBe(0);
            expect(divs[2]?.props.style).toEqual({
                height: "100%",
                left: 0,
                pointerEvents: "none",
                position: "absolute",
                scrollSnapAlign: "start",
                top: 0,
                width: 1,
            });
            expect(divs[3]?.props["data-legend-list-snap-anchor"]).toBe(296);
            expect(divs[3]?.props.style.left).toBe(296);
            expect(divs[4]?.props["data-legend-list-snap-anchor"]).toBe(592);
            expect(divs[4]?.props.style.left).toBe(592);
        } finally {
            act(() => {
                renderer?.unmount();
            });
        }
    });

    it("renders complete vertical CSS snap anchors from snap offsets", async () => {
        resetMocks();
        const { ListComponentScrollView } = await import("../../src/components/ListComponentScrollView?web-snap-y");
        let renderer: TestRenderer.ReactTestRenderer | undefined;

        try {
            act(() => {
                renderer = TestRenderer.create(
                    <ListComponentScrollView
                        onLayout={() => {}}
                        onScroll={() => {}}
                        snapToOffsets={[0, 120, Number.POSITIVE_INFINITY, Number.NaN, 240]}
                        style={{}}
                    >
                        <div />
                    </ListComponentScrollView>,
                );
            });

            const divs = renderer!.root.findAllByType("div");
            expect(divs[0]?.props.style.scrollSnapType).toBe("y mandatory");
            expect(divs[2]?.props["data-legend-list-snap-anchor"]).toBe(0);
            expect(divs[2]?.props.style).toEqual({
                height: 1,
                left: 0,
                pointerEvents: "none",
                position: "absolute",
                scrollSnapAlign: "start",
                top: 0,
                width: "100%",
            });
            expect(divs[3]?.props["data-legend-list-snap-anchor"]).toBe(120);
            expect(divs[3]?.props.style.top).toBe(120);
            expect(divs[4]?.props["data-legend-list-snap-anchor"]).toBe(240);
            expect(divs[4]?.props.style.top).toBe(240);
            expect(divs).toHaveLength(5);
        } finally {
            act(() => {
                renderer?.unmount();
            });
        }
    });

    it("does not add the hidden scrollbar class for window scrolling", async () => {
        resetMocks();
        const { ListComponentScrollView } = await import(
            "../../src/components/ListComponentScrollView?web-scroll-hidden-window-scroll"
        );
        let renderer: TestRenderer.ReactTestRenderer | undefined;

        try {
            act(() => {
                renderer = TestRenderer.create(
                    <ListComponentScrollView
                        className="outer-scroll"
                        onLayout={() => {}}
                        onScroll={() => {}}
                        showsVerticalScrollIndicator={false}
                        style={{}}
                        useWindowScroll
                    >
                        <div />
                    </ListComponentScrollView>,
                );
            });

            const divs = renderer!.root.findAllByType("div");
            expect(divs[0]?.props.className).toBe("outer-scroll");
            expect(divs[0]?.props.style.overflow).toBeUndefined();
        } finally {
            act(() => {
                renderer?.unmount();
            });
        }
    });

    it("injects scrollbar hiding CSS when hiding the default scroll indicator", async () => {
        resetMocks();
        const originalDocument = globalThis.document;
        const styleElement = { id: "", textContent: "" };
        const appendChild = mock(() => {});

        globalThis.document = {
            createElement: mock(() => styleElement),
            getElementById: mock(() => null),
            head: {
                appendChild,
            },
        } as unknown as Document;

        const { ListComponentScrollView } = await import("../../src/components/ListComponentScrollView?web-scroll-css");
        let renderer: TestRenderer.ReactTestRenderer | undefined;

        try {
            act(() => {
                renderer = TestRenderer.create(
                    <ListComponentScrollView
                        onLayout={() => {}}
                        onScroll={() => {}}
                        showsVerticalScrollIndicator={false}
                        style={{}}
                    >
                        <div />
                    </ListComponentScrollView>,
                );
            });

            expect(appendChild).toHaveBeenCalledWith(styleElement);
            expect(styleElement.id).toBe("legend-list-scrollbar-axis-hidden-style");
            expect(styleElement.textContent).toContain(
                ".legend-list-scrollbar-y-hidden::-webkit-scrollbar:vertical{width:0;display:none;}",
            );
            expect(styleElement.textContent).toContain(
                ".legend-list-scrollbar-x-hidden::-webkit-scrollbar:horizontal{height:0;display:none;}",
            );
        } finally {
            act(() => {
                renderer?.unmount();
            });
            globalThis.document = originalDocument;
        }
    });

    it("renders vertical contentInsetEndAdjustment as trailing content", async () => {
        resetMocks();
        mockCtx.state.props.contentInsetEndAdjustment = 32;
        const { ListComponentScrollView } = await import(
            "../../src/components/ListComponentScrollView?web-scroll-overlay-inset-vertical"
        );
        let renderer: TestRenderer.ReactTestRenderer | undefined;

        try {
            act(() => {
                renderer = TestRenderer.create(
                    <ListComponentScrollView
                        contentContainerStyle={{ padding: "8px 16px" }}
                        onLayout={() => {}}
                        onScroll={() => {}}
                        style={{}}
                    >
                        <div />
                    </ListComponentScrollView>,
                );
            });

            const divs = renderer!.root.findAllByType("div");
            expect(divs[1]?.props.style.padding).toBe("8px 16px");
            expect(divs[3]?.props["aria-hidden"]).toBe(true);
            expect(divs[3]?.props.style).toEqual({ height: 32 });
        } finally {
            act(() => {
                renderer?.unmount();
            });
        }
    });

    it("renders horizontal contentInsetEndAdjustment as trailing content", async () => {
        resetMocks();
        mockCtx.state.props.contentInsetEndAdjustment = 24;
        const { ListComponentScrollView } = await import(
            "../../src/components/ListComponentScrollView?web-scroll-overlay-inset-horizontal"
        );
        let renderer: TestRenderer.ReactTestRenderer | undefined;

        try {
            act(() => {
                renderer = TestRenderer.create(
                    <ListComponentScrollView
                        contentContainerStyle={{ paddingRight: 6 }}
                        horizontal
                        onLayout={() => {}}
                        onScroll={() => {}}
                        style={{}}
                    >
                        <div />
                    </ListComponentScrollView>,
                );
            });

            const divs = renderer!.root.findAllByType("div");
            expect(divs[1]?.props.style.paddingRight).toBe(6);
            expect(divs[3]?.props["aria-hidden"]).toBe(true);
            expect(divs[3]?.props.style).toEqual({ flexShrink: 0, width: 24 });
        } finally {
            act(() => {
                renderer?.unmount();
            });
        }
    });

    it("does not double count anchored end space that already renders into the DOM", async () => {
        resetMocks();
        mockCtx.state.anchoredEndSpaceSize = 24;
        mockCtx.state.props.anchoredEndSpace = { includeInEndInset: true };
        mockCtx.state.props.contentInsetEndAdjustment = 40;
        const { ListComponentScrollView } = await import(
            "../../src/components/ListComponentScrollView?web-scroll-overlay-inset-anchored"
        );
        let renderer: TestRenderer.ReactTestRenderer | undefined;

        try {
            act(() => {
                renderer = TestRenderer.create(
                    <ListComponentScrollView
                        contentContainerStyle={{ paddingBottom: 8 }}
                        onLayout={() => {}}
                        onScroll={() => {}}
                        style={{}}
                    >
                        <div />
                    </ListComponentScrollView>,
                );
            });

            const divs = renderer!.root.findAllByType("div");
            expect(divs[1]?.props.style.paddingBottom).toBe(8);
            expect(divs[3]?.props["aria-hidden"]).toBe(true);
            expect(divs[3]?.props.style).toEqual({ height: 16 });
        } finally {
            act(() => {
                renderer?.unmount();
            });
        }
    });
});
