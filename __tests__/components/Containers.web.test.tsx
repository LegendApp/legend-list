import { describe, expect, it, mock } from "bun:test";
import "../setup";

import TestRenderer, { act } from "../helpers/testRenderer";

const mockCtx = {
    columnWrapperStyle: undefined as Record<string, any> | undefined,
    state: {
        adjustingFromInitialMount: undefined as number | undefined,
        deferredPositions: undefined as { kind?: string } | undefined,
        initialScroll: undefined as { index?: number; viewPosition?: number } | undefined,
        initialScrollLastTarget: undefined as { index?: number; viewPosition?: number } | undefined,
        scrollingTo: undefined as { isInitialScroll?: boolean } | undefined,
    },
    values: new Map<string, any>([
        ["numContainersPooled", 1],
        ["numColumns", 1],
        ["otherAxisSize", 0],
        ["readyToRender", true],
        ["totalSize", 0],
    ]),
};

mock.module("@/components/Container", () => ({
    Container: () => null,
}));

mock.module("@/hooks/useDOMOrder", () => ({
    useDOMOrder: () => {},
}));

mock.module("@/state/state", () => ({
    useArr$: (keys: string[]) => keys.map((key) => mockCtx.values.get(key)),
    useStateContext: () => mockCtx,
}));

function resetMockCtx() {
    mockCtx.columnWrapperStyle = undefined;
    mockCtx.state.adjustingFromInitialMount = undefined;
    mockCtx.state.deferredPositions = undefined;
    mockCtx.state.initialScroll = undefined;
    mockCtx.state.initialScrollLastTarget = undefined;
    mockCtx.state.scrollingTo = undefined;
    mockCtx.values.set("numContainersPooled", 1);
    mockCtx.values.set("numColumns", 1);
    mockCtx.values.set("otherAxisSize", 0);
    mockCtx.values.set("readyToRender", true);
    mockCtx.values.set("totalSize", 0);
}

describe("Containers (web)", () => {
    it("hides the first frame for end-aligned initial scroll while web bootstrap is active", async () => {
        resetMockCtx();
        mockCtx.values.set("readyToRender", false);
        mockCtx.state.initialScrollLastTarget = { index: 100, viewPosition: 1 };
        mockCtx.state.deferredPositions = { kind: "initial_scroll" };

        const { Containers } = await import("../../src/components/Containers?containers-web-hidden");
        let renderer: TestRenderer.ReactTestRenderer | undefined;

        try {
            act(() => {
                renderer = TestRenderer.create(
                    <Containers
                        getRenderedItem={() => null}
                        horizontal={false}
                        recycleItems={false}
                        updateItemSize={() => {}}
                        waitForInitialLayout
                    />,
                );
            });

            const style = (renderer!.toJSON() as any)?.props?.style;
            expect(style?.visibility).toBe("hidden");
            expect(style?.pointerEvents).toBe("none");
        } finally {
            act(() => {
                renderer?.unmount();
            });
        }
    });

    it("hides the first frame for end-aligned initial scroll when readyToRender is still unset", async () => {
        resetMockCtx();
        mockCtx.values.delete("readyToRender");
        mockCtx.state.initialScrollLastTarget = { index: 100, viewPosition: 1 };
        mockCtx.state.deferredPositions = { kind: "initial_scroll" };

        const { Containers } = await import("../../src/components/Containers?containers-web-hidden-unset");
        let renderer: TestRenderer.ReactTestRenderer | undefined;

        try {
            act(() => {
                renderer = TestRenderer.create(
                    <Containers
                        getRenderedItem={() => null}
                        horizontal={false}
                        recycleItems={false}
                        updateItemSize={() => {}}
                        waitForInitialLayout
                    />,
                );
            });

            const style = (renderer!.toJSON() as any)?.props?.style;
            expect(style?.visibility).toBe("hidden");
            expect(style?.pointerEvents).toBe("none");
        } finally {
            act(() => {
                renderer?.unmount();
            });
        }
    });

    it("keeps the first frame hidden while a queued initial-mount adjust is still pending", async () => {
        resetMockCtx();
        mockCtx.values.delete("readyToRender");
        mockCtx.state.adjustingFromInitialMount = 1;
        mockCtx.state.initialScrollLastTarget = { index: 100, viewPosition: 1 };

        const { Containers } = await import("../../src/components/Containers?containers-web-hidden-adjusting");
        let renderer: TestRenderer.ReactTestRenderer | undefined;

        try {
            act(() => {
                renderer = TestRenderer.create(
                    <Containers
                        getRenderedItem={() => null}
                        horizontal={false}
                        recycleItems={false}
                        updateItemSize={() => {}}
                        waitForInitialLayout
                    />,
                );
            });

            const style = (renderer!.toJSON() as any)?.props?.style;
            expect(style?.visibility).toBe("hidden");
            expect(style?.pointerEvents).toBe("none");
        } finally {
            act(() => {
                renderer?.unmount();
            });
        }
    });

    it("does not hide normal initialScrollIndex bootstrap", async () => {
        resetMockCtx();
        mockCtx.values.set("readyToRender", false);
        mockCtx.state.initialScrollLastTarget = { index: 200, viewPosition: 0 };
        mockCtx.state.scrollingTo = { isInitialScroll: true };

        const { Containers } = await import("../../src/components/Containers?containers-web-visible");
        let renderer: TestRenderer.ReactTestRenderer | undefined;

        try {
            act(() => {
                renderer = TestRenderer.create(
                    <Containers
                        getRenderedItem={() => null}
                        horizontal={false}
                        recycleItems={false}
                        updateItemSize={() => {}}
                        waitForInitialLayout
                    />,
                );
            });

            const style = (renderer!.toJSON() as any)?.props?.style;
            expect(style?.visibility).toBeUndefined();
            expect(style?.pointerEvents).toBeUndefined();
        } finally {
            act(() => {
                renderer?.unmount();
            });
        }
    });
});
