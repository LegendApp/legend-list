import { expect, it, mock, spyOn } from "bun:test";
import "../setup";
mock.module("@/constants-platform", () => ({ IsNewArchitecture: false }));
const { processContainerLayout } = await import("../../src/hooks/useContainerMeasurement");
const { createMockContext } = await import("../__mocks__/createMockContext");
const calculateModule = await import("../../src/core/calculateItemsInView");

it("rejects a delayed native measure after same-key invalidation without overwriting local size", () => {
    const ctx = createMockContext(
        { containerItemKey0: "item_0", otherAxisSize: 400, readyToRender: true },
        {
            didContainersLayout: true,
            idCache: ["item_0"],
            indexByKey: new Map([["item_0", 0]]),
            props: { data: [{ id: "item_0" }], estimatedItemSize: 100 },
        },
    );
    ctx.state.containerItemKeys.set("item_0", 0);
    ctx.state.containerItemGenerations[0] = 1;
    const calculate = spyOn(calculateModule, "calculateItemsInView").mockImplementation(() => {});
    let measure: (x: number, y: number, width: number, height: number) => void;
    const state = { didLayout: false, horizontal: false, itemKey: "item_0", lastSize: { height: 100, width: 400 } };
    try {
        processContainerLayout({
            containerId: 0,
            ctx,
            rectangle: { height: 0, width: 400, x: 0, y: 0 },
            ref: {
                current: {
                    measure: (callback: typeof measure) => {
                        measure = callback;
                    },
                } as any,
            },
            state,
        });
        ctx.state.containerItemGenerations[0] = 2;
        measure!(0, 0, 400, 250);
        expect(ctx.state.sizesKnown.has("item_0")).toBe(false);
        expect(state.lastSize.height).toBe(100);
        expect(calculate).not.toHaveBeenCalled();
        processContainerLayout({
            containerId: 0,
            ctx,
            rectangle: { height: 160, width: 400, x: 0, y: 0 },
            ref: { current: null },
            state,
        });
        expect(ctx.state.sizesKnown.get("item_0")).toBe(160);
        expect(state.lastSize.height).toBe(160);
        expect(calculate).toHaveBeenCalledTimes(1);
    } finally {
        calculate.mockRestore();
        ctx.state.scheduledWork.dispose();
    }
});

it("requests fresh legacy layouts for every mounted container after geometry invalidation", async () => {
    mock.module("@/constants-platform", () => ({ IsNewArchitecture: false }));
    const { triggerMountedContainerLayouts } = await import("../../src/core/scheduleContainerLayout");
    const ctx = createMockContext();
    const first = mock(() => {});
    const second = mock(() => {});
    ctx.containerLayoutTriggers.set(0, first);
    ctx.containerLayoutTriggers.set(3, second);
    triggerMountedContainerLayouts(ctx);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    expect(ctx.pendingContainerIds).toBeUndefined();
});

it("remeasures unchanged legacy rows when their registered layout trigger fires", async () => {
    mock.module("@/constants-platform", () => ({ IsNewArchitecture: false }));
    const React = await import("react");
    const { act, render } = await import("../helpers/testingLibrary");
    const { useContainerMeasurement } = await import("../../src/hooks/useContainerMeasurement");
    const ctx = createMockContext(
        { containerItemKey0: "item_0", otherAxisSize: 400, readyToRender: true },
        {
            didContainersLayout: true,
            idCache: ["item_0"],
            indexByKey: new Map([["item_0", 0]]),
            props: { data: [{ id: "item_0" }], estimatedItemSize: 100 },
        },
    );
    ctx.state.containerItemKeys.set("item_0", 0);
    const calculate = spyOn(calculateModule, "calculateItemsInView").mockImplementation(() => {});
    const measure = mock((callback: (x: number, y: number, width: number, height: number) => void) =>
        callback(0, 0, 400, 160),
    );
    const ref = { current: { measure } } as any;
    let onLayout: (event: any) => void;
    function Row() {
        ({ onLayout } = useContainerMeasurement({ containerId: 0, ctx, horizontal: false, itemKey: "item_0", ref }));
        return null;
    }
    const screen = render(React.createElement(Row));
    try {
        await act(async () => onLayout({ nativeEvent: { layout: { height: 160, width: 400, x: 0, y: 0 } } }));
        expect(ctx.state.sizesKnown.get("item_0")).toBe(160);
        for (let round = 1; round <= 2; round++) {
            ctx.state.sizesKnown.clear();
            ctx.state.sizes.clear();
            await act(async () => ctx.containerLayoutTriggers.get(0)!());
            expect(measure).toHaveBeenCalledTimes(round);
            expect(ctx.state.sizesKnown.get("item_0")).toBe(160);
        }
    } finally {
        screen.unmount();
        calculate.mockRestore();
        ctx.state.scheduledWork.dispose();
    }
});

it("remeasures only mounted invalidated source rows after commit and rejects old generations", async () => {
    mock.module("@/constants-platform", () => ({ IsNewArchitecture: false }));
    const React = await import("react");
    const { act, render } = await import("../helpers/testingLibrary");
    const { useContainerMeasurement } = await import("../../src/hooks/useContainerMeasurement");
    const { applyDataSourceMutationBatches } = await import("../../src/core/DataSourceMutationCoordinator");
    const { syncLayoutStoreStructure } = await import("../../src/core/layoutStoreLifecycle");
    const item = { id: "item_0" };
    const source = {
        getItem: () => item,
        getKey: () => item.id,
        getLength: () => 1,
        getRevision: () => 0,
        subscribe: () => () => {},
    };
    const ctx = createMockContext(
        { containerItemKey0: item.id, otherAxisSize: 400, readyToRender: true },
        {
            didContainersLayout: true,
            idCache: [item.id],
            indexByKey: new Map([[item.id, 0]]),
            props: { dataSource: source, estimatedItemSize: 100 },
        },
    );
    ctx.state.containerItemKeys.set(item.id, 0);
    const store = syncLayoutStoreStructure(ctx)!;
    const calculate = spyOn(calculateModule, "calculateItemsInView").mockImplementation(() => {});
    const callbacks: Array<(x: number, y: number, width: number, height: number) => void> = [];
    const measure = mock((callback: (typeof callbacks)[number]) => callbacks.push(callback));
    const unaffected = mock(() => {});
    ctx.containerLayoutTriggers.set(3, unaffected);
    const ref = { current: { measure } } as any;
    let onLayout: (event: any) => void;
    let commits = 0;
    function Row() {
        ({ onLayout } = useContainerMeasurement({ containerId: 0, ctx, horizontal: false, itemKey: item.id, ref }));
        React.useLayoutEffect(() => {
            commits++;
        });
        return null;
    }
    const screen = render(React.createElement(Row));
    try {
        await act(async () => onLayout({ nativeEvent: { layout: { height: 160, width: 400, x: 0, y: 0 } } }));
        for (let round = 1; round <= 2; round++) {
            const previousCommits = commits;
            await act(async () => {
                const result = applyDataSourceMutationBatches(ctx, source, [
                    {
                        length: 1,
                        operations: [{ count: 1, index: 0, layout: "invalidate", type: "update" }],
                        previousLength: 1,
                        previousRevision: round - 1,
                        revision: round,
                    },
                ]);
                expect(result.applied).toBe(true);
                expect(measure).toHaveBeenCalledTimes(round - 1);
            });
            expect(commits).toBeGreaterThan(previousCommits);
            expect(measure).toHaveBeenCalledTimes(round);
            expect(ctx.state.sizesKnown.get(item.id)).toBeUndefined();
            expect(store.getSize(0)).toBe(100);
            if (round === 2) {
                callbacks[0](0, 0, 400, 250);
                expect(ctx.state.sizesKnown.get(item.id)).toBeUndefined();
                expect(store.getSize(0)).toBe(100);
            }
            callbacks[round - 1](0, 0, 400, 160);
            expect(ctx.state.sizesKnown.get(item.id)).toBe(160);
            expect(store.getSize(0)).toBe(160);
        }
        expect(unaffected).not.toHaveBeenCalled();
    } finally {
        screen.unmount();
        calculate.mockRestore();
        ctx.state.scheduledWork.dispose();
    }
});
