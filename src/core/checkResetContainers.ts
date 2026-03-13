import { calculateItemsInView } from "@/core/calculateItemsInView";
import { doMaintainScrollAtEnd } from "@/core/doMaintainScrollAtEnd";
import type { StateContext } from "@/state/state";
import { checkThresholds } from "@/utils/checkThresholds";
import { logScrollControllerDebug } from "@/utils/debugScrollControllers";
import { updateAveragesOnDataChange } from "@/utils/updateAveragesOnDataChange";

export function checkResetContainers(ctx: StateContext, dataProp: readonly unknown[]) {
    const state = ctx.state;
    const { previousData } = state;
    // Preserve averages for items that are considered equal before updating data
    if (previousData) {
        updateAveragesOnDataChange(state, previousData, dataProp);
    }
    const { maintainScrollAtEnd } = state.props;

    calculateItemsInView(ctx, { dataChanged: true, doMVCP: true });

    const shouldMaintainScrollAtEnd = maintainScrollAtEnd?.onDataChange;
    if (shouldMaintainScrollAtEnd) {
        logScrollControllerDebug("maintain:end-trigger", {
            isAtEnd: state.isAtEnd,
            reason: "data-change",
            scroll: state.scroll,
        });
    }

    const didMaintainScrollAtEnd = shouldMaintainScrollAtEnd && doMaintainScrollAtEnd(ctx);

    // Reset the endReached flag if new data has been added and we didn't
    // just maintain the scroll at end
    if (!didMaintainScrollAtEnd && previousData && dataProp.length > previousData.length) {
        state.isEndReached = false;
    }

    if (!didMaintainScrollAtEnd) {
        checkThresholds(ctx);
    }

    delete state.previousData;
}
