import { finalizeDataChange } from "@/core/finalizeDataChange";
import { startPrependTransaction } from "@/core/prependTransaction";
import type { StateContext } from "@/state/state";
import { updateAveragesOnDataChange } from "@/utils/updateAveragesOnDataChange";

export function checkResetContainers(ctx: StateContext, dataProp: readonly unknown[]) {
    const state = ctx.state;
    const { previousData } = state;
    if (startPrependTransaction(ctx, previousData, dataProp)) {
        return;
    }

    // Preserve averages for items that are considered equal before updating data
    if (previousData) {
        updateAveragesOnDataChange(state, previousData, dataProp);
    }
    finalizeDataChange(ctx, dataProp.length);
}
