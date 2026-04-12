import { POSITION_OUT_OF_VIEW } from "@/constants";
import { peek$, set$, type StateContext } from "@/state/state";

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
        props: { data, itemsAreEqual },
    } = state;
    const item = data[itemIndex];
    if (item === undefined) {
        return false;
    }

    const updateLayout = options?.updateLayout ?? true;
    let didChangePosition = false;

    if (updateLayout) {
        const positionValue = positions[itemIndex];
        if (positionValue === undefined) {
            set$(ctx, `containerPosition${containerIndex}`, POSITION_OUT_OF_VIEW);
            return false;
        }

        const position = (positionValue || 0) - (options?.scrollAdjustPending ?? 0);
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
    if (prevData !== item && (itemsAreEqual ? !itemsAreEqual(prevData, item, itemIndex, data) : true)) {
        set$(ctx, `containerItemData${containerIndex}`, item);
    }

    return didChangePosition;
}
