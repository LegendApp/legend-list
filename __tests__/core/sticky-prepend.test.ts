import { expect, it } from "bun:test";
import { calculateItemsInView } from "../../src/core/calculateItemsInView";
import { checkResetContainers } from "../../src/core/checkResetContainers";
import { Platform } from "../../src/platform/Platform";
import { createImperativeHandle } from "../../src/utils/createImperativeHandle";
import { normalizeMaintainVisibleContentPosition } from "../../src/utils/normalizeMaintainVisibleContentPosition";
import { createMockContext } from "../__mocks__/createMockContext";

interface Row {
    fixed?: number;
    id: string;
}

it("preserves the prepend anchor when fixed sizes change the active sticky predecessor", () => {
    const previousRows: Row[] = Array.from({ length: 12 }, (_, index) => ({ id: `old-${index}` }));
    previousRows[0].fixed = 100;
    const fixedSizes: Record<number, number> = { 4: 30, 9: 50, 14: 20, 15: 20 };
    const prependedRows: Row[] = Array.from({ length: 16 }, (_, index) => ({
        fixed: fixedSizes[index],
        id: `new-${index}`,
    }));
    const rows = [...prependedRows, ...previousRows.slice(1)];
    const resolvedIds = new Set<string>();
    const ctx = createMockContext(
        { numColumns: 1, numContainers: 12, readyToRender: true },
        {
            didContainersLayout: true,
            didFinishInitialScroll: true,
            isFirst: false,
            props: {
                data: previousRows,
                drawDistance: 0,
                estimatedItemSize: 100,
                getFixedItemSize: (row: Row) => {
                    resolvedIds.add(row.id);
                    return row.fixed;
                },
                keyExtractor: (row: Row) => row.id,
                maintainVisibleContentPosition: normalizeMaintainVisibleContentPosition(true),
                stickyHeaderIndicesArr: [0],
                stickyHeaderIndicesSet: new Set([0]),
            },
            scroll: 11,
            scrollLength: 220,
        },
    );
    const { state } = ctx;
    const ref = createImperativeHandle(ctx);
    const previousOS = Platform.OS;
    Platform.OS = "android";
    try {
        calculateItemsInView(ctx, { forceFullItemPositions: true, scrollVelocity: 0 });
        const before = ref.getState().positionByKey("old-1")! - state.scroll;
        expect(before).toBe(89);
        expect(state.idsInView[0]).toBe("old-1");

        const snapshot = () => {
            const { activeStickyIndex, positionAtIndex, positionByKey, scroll } = ref.getState();
            return {
                activeStickyIndex,
                anchorTop: positionByKey("old-1")!,
                predecessorSize: positionAtIndex(5) - positionAtIndex(4),
                scroll,
            };
        };
        const corrections: ReturnType<typeof snapshot>[] = [];
        const recordCorrection = () => {
            corrections.push(snapshot());
        };
        state.scrollAdjustHandler.requestAdjust = recordCorrection;
        ctx.doScrollTo = recordCorrection;
        state.previousData = previousRows;
        state.props.data = rows;
        state.props.stickyHeaderIndicesArr = [4, 9, 14];
        state.props.stickyHeaderIndicesSet = new Set([4, 9, 14]);
        checkResetContainers(ctx, rows);

        const after = snapshot();
        expect(after.activeStickyIndex).toBe(9);
        expect(after.predecessorSize).toBe(30);
        expect(corrections).toEqual([
            expect.objectContaining({ anchorTop: after.anchorTop, predecessorSize: 30, scroll: after.scroll }),
        ]);
        expect(resolvedIds.has("new-7")).toBe(false);
        expect(after.anchorTop - after.scroll).toBe(before);
    } finally {
        state.scheduledWork.dispose();
        Platform.OS = previousOS;
    }
});
