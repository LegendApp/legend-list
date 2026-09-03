import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import "../setup";

import {
    attachExactInitialLayout,
    resolveExactInitialLayout,
    seedExactInitialLayoutState,
    shouldFinishExactInitialScrollWithoutScroll,
    useExactInitialLayoutFirstCommit,
    verifyExactInitialLayoutOnMeasure,
} from "../../src/core/exactInitialLayout.native";
import { Platform } from "../../src/platform/Platform";
import { StateProvider } from "../../src/state/state";
import { clearWarnDevOnceForTests } from "../../src/utils/helpers";
import { createMockContext } from "../__mocks__/createMockContext";
import { render } from "../helpers/testingLibrary";

const data = Array.from({ length: 4 }, (_, index) => ({ id: `item-${index}` }));

function createOptions(overrides: Record<string, unknown> = {}) {
    return {
        alignItemsAtEnd: false,
        anchoredEndSpace: undefined,
        columnWrapperStyle: undefined,
        contentInset: undefined,
        contentInsetAdjustmentBehavior: undefined,
        contentInsetEndAdjustment: undefined,
        data,
        exactInitialLayout: { height: 200, width: 200 },
        getFixedItemSize: () => 100,
        getItemType: undefined,
        hasActiveRefreshControl: false,
        hasItemSeparator: false,
        hasListFooter: false,
        hasListHeader: false,
        horizontal: false,
        initialScroll: { index: 2, viewOffset: 20, viewPosition: 0.5 },
        isNewArchitecture: true,
        isRTL: false,
        numColumns: 1,
        overrideItemLayout: undefined,
        renderScrollComponent: undefined,
        scrollAxisPaddingEnd: 0,
        scrollAxisPaddingStart: 0,
        snapToIndices: undefined,
        stickyHeaderIndices: undefined,
        useWindowScroll: false,
        ...overrides,
    };
}

beforeEach(() => {
    clearWarnDevOnceForTests();
    Platform.OS = "ios";
});

afterEach(() => {
    Platform.OS = "ios";
});

describe("exact initial layout", () => {
    it("resolves fixed positions, total size, and aligned target offset", () => {
        const resolution = resolveExactInitialLayout(createOptions());

        expect(resolution).toEqual({
            snapshot: {
                averageItemSize: 100,
                height: 200,
                positions: [0, 100, 200, 300],
                sizes: [100, 100, 100, 100],
                targetIndex: 2,
                targetOffset: 130,
                totalSize: 400,
                viewportLength: 200,
                width: 200,
            },
        });
    });

    it("clamps initialScrollAtEnd to the content end", () => {
        const resolution = resolveExactInitialLayout(
            createOptions({
                initialScroll: { index: 3, viewOffset: 0, viewPosition: 1 },
            }),
        );

        expect(resolution?.snapshot?.targetOffset).toBe(200);
    });

    it.each([
        [
            "old architecture",
            { isNewArchitecture: false },
            "experimental_exactInitialLayout requires the new architecture (Fabric).",
        ],
        [
            "invalid viewport",
            { exactInitialLayout: { height: 0, width: 200 } },
            "experimental_exactInitialLayout requires positive finite width and height.",
        ],
        ["empty data", { data: [] }, "experimental_exactInitialLayout requires non-empty initial data."],
        [
            "multiple columns",
            { numColumns: 2 },
            "experimental_exactInitialLayout currently supports single-column lists only.",
        ],
        [
            "horizontal RTL",
            { horizontal: true, isRTL: true },
            "experimental_exactInitialLayout does not yet support horizontal RTL lists.",
        ],
        [
            "measured layout modifier",
            { hasListHeader: true },
            "experimental_exactInitialLayout does not support layout modifiers whose initial contribution is measured after mount.",
        ],
        [
            "missing fixed size",
            { getFixedItemSize: undefined },
            "experimental_exactInitialLayout requires getFixedItemSize.",
        ],
        [
            "invalid target",
            { initialScroll: { index: 10 } },
            "experimental_exactInitialLayout requires an in-range integer initialScrollIndex.",
        ],
        [
            "invalid item size",
            { getFixedItemSize: () => 0 },
            "experimental_exactInitialLayout requires a positive finite getFixedItemSize result for every initial item.",
        ],
    ])("rejects %s", (_name, overrides, reason) => {
        expect(resolveExactInitialLayout(createOptions(overrides))).toEqual({ reason });
    });

    it("warns once and falls back for an unsupported configuration", () => {
        const warn = spyOn(console, "warn").mockImplementation(() => {});

        function Probe() {
            useExactInitialLayoutFirstCommit(() => createOptions({ getFixedItemSize: undefined }));
            return null;
        }

        render(
            <>
                <StateProvider>
                    <Probe />
                </StateProvider>
                <StateProvider>
                    <Probe />
                </StateProvider>
            </>,
        );

        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls[0]?.[0]).toContain("requires getFixedItemSize");
        warn.mockRestore();
    });

    it("attaches and seeds exact geometry into list state", () => {
        const resolution = resolveExactInitialLayout(createOptions());
        const ctx = createMockContext(
            {},
            {
                props: {
                    data,
                    keyExtractor: (item: { id: string }) => item.id,
                },
            },
        );
        ctx.exactInitialLayout = resolution?.snapshot ?? null;

        attachExactInitialLayout(ctx);
        seedExactInitialLayoutState(ctx);

        expect(ctx.values.get("initialContentVisible")).toBe(true);
        expect(ctx.values.get("totalSize")).toBe(400);
        expect(ctx.state.positions).toEqual([0, 100, 200, 300]);
        expect(ctx.state.sizesKnown).toEqual(new Map(data.map((item) => [item.id, 100])));
        expect(ctx.state.scrollLength).toBe(200);
        expect(ctx.state.scroll).toBe(130);
    });

    it("invalidates early visibility when the measured viewport differs", () => {
        const resolution = resolveExactInitialLayout(createOptions());
        const ctx = createMockContext({ initialContentVisible: true });
        ctx.state.exactInitialLayout = { snapshot: resolution!.snapshot! };

        const warn = spyOn(console, "warn").mockImplementation(() => {});
        verifyExactInitialLayoutOnMeasure(ctx, { height: 220, width: 200, x: 0, y: 0 });

        expect(ctx.state.exactInitialLayout.invalidated).toBe(true);
        expect(ctx.values.get("initialContentVisible")).toBe(false);
        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls[0]?.[0]).toContain("declared 200x200");
        warn.mockRestore();
    });

    it("finishes without correction only when iOS geometry and native offset match", () => {
        const resolution = resolveExactInitialLayout(createOptions());
        const ctx = createMockContext({ initialContentVisible: true });
        ctx.state.exactInitialLayout = {
            observedNativeOffset: 130,
            snapshot: resolution!.snapshot!,
            verified: true,
        };

        expect(
            shouldFinishExactInitialScrollWithoutScroll(ctx, 130, {
                areMountedBufferedIndicesMeasured: true,
                areVisibleIndicesMeasured: true,
            }),
        ).toBe(true);

        Platform.OS = "android";
        expect(
            shouldFinishExactInitialScrollWithoutScroll(ctx, 130, {
                areMountedBufferedIndicesMeasured: true,
                areVisibleIndicesMeasured: true,
            }),
        ).toBe(false);
    });

    it("invalidates the exact path when the settled offset differs", () => {
        const resolution = resolveExactInitialLayout(createOptions());
        const ctx = createMockContext({ initialContentVisible: true });
        ctx.state.exactInitialLayout = {
            observedNativeOffset: 100,
            snapshot: resolution!.snapshot!,
            verified: true,
        };
        const warn = spyOn(console, "warn").mockImplementation(() => {});

        expect(
            shouldFinishExactInitialScrollWithoutScroll(ctx, 130, {
                areMountedBufferedIndicesMeasured: true,
                areVisibleIndicesMeasured: true,
            }),
        ).toBe(false);
        expect(ctx.state.exactInitialLayout.invalidated).toBe(true);
        expect(ctx.values.get("initialContentVisible")).toBe(false);
        expect(warn).toHaveBeenCalledTimes(1);
        warn.mockRestore();
    });

    it("invalidates stale exact state when initial render state resets", async () => {
        const resolution = resolveExactInitialLayout(createOptions());
        const ctx = createMockContext({ initialContentVisible: true });
        ctx.state.exactInitialLayout = { snapshot: resolution!.snapshot! };
        const { resetInitialRenderState } = await import("../../src/utils/setInitialRenderState");

        resetInitialRenderState(ctx, { resetLayout: true });

        expect(ctx.state.exactInitialLayout.invalidated).toBe(true);
        expect(ctx.values.get("initialContentVisible")).toBe(false);
    });
});
