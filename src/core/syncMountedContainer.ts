import { POSITION_OUT_OF_VIEW } from "@/constants";
import { peek$, type StateContext, set$ } from "@/state/state";
import { getId } from "@/utils/getId";
import { getItemSize } from "@/utils/getItemSize";
import { toPhysicalHorizontalItemPosition } from "@/utils/rtl";

export function syncMountedContainer(
    ctx: StateContext,
    containerIndex: number,
    itemIndex: number,
    options?: { scrollAdjustPending?: number; updateLayout?: boolean },
) {
    const state = ctx.state;
    const {
        columns,
        columnSpans,
        positions,
        props: { data, itemsAreEqual, keyExtractor },
    } = state;
    const item = data[itemIndex];
    if (item === undefined) {
        return { didChangePosition: false, didRefreshData: false };
    }
    const itemKey = state.idCache[itemIndex] ?? getId(state, itemIndex);

    const updateLayout = options?.updateLayout ?? true;
    let didChangePosition = false;
    let didRefreshData = false;

    if (updateLayout) {
        const positionValue = positions[itemIndex];
        if (positionValue === undefined) {
            set$(ctx, `containerPosition${containerIndex}`, POSITION_OUT_OF_VIEW);
            return { didChangePosition: false, didRefreshData: false };
        }

        const logicalPosition = (positionValue || 0) - (options?.scrollAdjustPending ?? 0);
        const itemSize = state.sizes.get(itemKey) ?? getItemSize(ctx, itemKey, itemIndex, item);
        const position = toPhysicalHorizontalItemPosition(state, logicalPosition, itemSize, peek$(ctx, "totalSize"));
        const column = columns[itemIndex] || 1;
        const span = columnSpans[itemIndex] || 1;

        const prevPos = peek$(ctx, `containerPosition${containerIndex}`);
        const prevColumn = peek$(ctx, `containerColumn${containerIndex}`);
        const prevSpan = peek$(ctx, `containerSpan${containerIndex}`);

        if (position > POSITION_OUT_OF_VIEW && position !== prevPos) {
            set$(ctx, `containerPosition${containerIndex}`, position);
            didChangePosition = true;
        }
        if (column >= 0 && column !== prevColumn) {
            set$(ctx, `containerColumn${containerIndex}`, column);
        }
        if (span !== prevSpan) {
            set$(ctx, `containerSpan${containerIndex}`, span);
        }
    }

    const prevData = peek$(ctx, `containerItemData${containerIndex}`);
    if (prevData !== item) {
        const pendingDataComparison =
            state.pendingDataComparison?.previousData === state.previousData &&
            state.pendingDataComparison?.nextData === data
                ? state.pendingDataComparison
                : undefined;
        const cachedComparison = pendingDataComparison?.byIndex[itemIndex] ?? 0;

        if (cachedComparison === 2) {
            set$(ctx, `containerItemData${containerIndex}`, item);
            didRefreshData = true;
        } else if (cachedComparison !== 1) {
            const nextItemKey = peek$(ctx, `containerItemKey${containerIndex}`) ?? itemKey;
            const prevKey = keyExtractor?.(prevData, itemIndex);
            if (prevData === undefined || !keyExtractor || prevKey !== nextItemKey) {
                set$(ctx, `containerItemData${containerIndex}`, item);
                didRefreshData = true;
            } else if (!itemsAreEqual) {
                set$(ctx, `containerItemData${containerIndex}`, item);
                didRefreshData = true;
            } else {
                const isEqual = itemsAreEqual(prevData, item, itemIndex, data);

                if (
                    !state.pendingDataComparison ||
                    state.pendingDataComparison.previousData !== state.previousData ||
                    state.pendingDataComparison.nextData !== data
                ) {
                    if (state.previousData) {
                        state.pendingDataComparison = {
                            byIndex: [],
                            nextData: data,
                            previousData: state.previousData,
                        };
                    }
                }
                if (state.pendingDataComparison?.byIndex) {
                    state.pendingDataComparison.byIndex[itemIndex] = isEqual ? 1 : 2;
                }

                if (!isEqual) {
                    set$(ctx, `containerItemData${containerIndex}`, item);
                    didRefreshData = true;
                }
            }
        }
    }

    return { didChangePosition, didRefreshData };
}
