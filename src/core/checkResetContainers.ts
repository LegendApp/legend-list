import { calculateItemsInView } from "@/core/calculateItemsInView";
import { doMaintainScrollAtEnd } from "@/core/doMaintainScrollAtEnd";
import type { StateContext } from "@/state/state";
import type { InternalState, MaintainScrollAtEndOptions } from "@/types";
import { checkAtBottom } from "@/utils/checkAtBottom";
import { checkAtTop } from "@/utils/checkAtTop";
import { updateAveragesOnDataChange } from "@/utils/updateAveragesOnDataChange";

export function checkResetContainers(
    ctx: StateContext,
    state: InternalState,
    isFirst: boolean,
    dataProp: readonly unknown[],
) {
    if (state) {
        // Preserve averages for items that are considered equal before updating data
        if (!isFirst && state.props.data !== dataProp) {
            updateAveragesOnDataChange(state, state.props.data, dataProp);
        }
        const { maintainScrollAtEnd } = state.props;

        if (!isFirst) {
            calculateItemsInView(ctx, state, { dataChanged: true, doMVCP: true });

            const shouldMaintainScrollAtEnd =
                maintainScrollAtEnd === true || (maintainScrollAtEnd as MaintainScrollAtEndOptions).onDataChange;

            const didMaintainScrollAtEnd = shouldMaintainScrollAtEnd && doMaintainScrollAtEnd(ctx, state, true);

            // Reset the endReached flag if new data has been added and we didn't
            // just maintain the scroll at end
            if (!didMaintainScrollAtEnd && dataProp.length > state.props.data.length) {
                state.isEndReached = false;
            }

            if (!didMaintainScrollAtEnd) {
                checkAtTop(state);
                checkAtBottom(ctx, state);
            }
        }
    }
}
