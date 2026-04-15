import { calculateItemsInView } from "@/core/calculateItemsInView";
import { doMaintainScrollAtEnd } from "@/core/doMaintainScrollAtEnd";
import type { StateContext } from "@/state/state";
import { checkThresholds } from "@/utils/checkThresholds";

export function checkResetContainers(ctx: StateContext, dataProp: readonly unknown[]) {
    const state = ctx.state;
    const { previousData } = state;
    const { maintainScrollAtEnd } = state.props;

    calculateItemsInView(ctx, { dataChanged: true, doMVCP: true });

    const shouldMaintainScrollAtEnd = maintainScrollAtEnd?.onDataChange;

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
