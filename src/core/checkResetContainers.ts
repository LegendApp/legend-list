import { calculateItemsInView } from "@/core/calculateItemsInView";
import { invalidateFixedItemSizes } from "@/core/containerItemMetadata";
import { doMaintainScrollAtEnd } from "@/core/doMaintainScrollAtEnd";
import { shouldMaintainScrollAtEndOnDataChange } from "@/core/shouldMaintainScrollAtEndOnDataChange";
import type { StateContext } from "@/state/state";
import { checkThresholds } from "@/utils/checkThresholds";
import { getId } from "@/utils/getId";

interface CheckResetContainersOptions {
    didColumnsChange?: boolean;
}

export function checkResetContainers(
    ctx: StateContext,
    dataProp: readonly unknown[],
    { didColumnsChange = false }: CheckResetContainersOptions = {},
) {
    const state = ctx.state;
    const { previousData } = state;
    const { maintainScrollAtEnd } = state.props;

    if (didColumnsChange) {
        state.sizes.clear();
        state.sizesKnown.clear();
        invalidateFixedItemSizes(state);
        for (const key in state.averageSizes) {
            delete state.averageSizes[key];
        }
        state.positionRecalculationStartIndex = 0;
        state.scrollForNextCalculateItemsInView = undefined;
    }

    // Keep data invalidated if calculation must wait for the first viewport.
    state.positionsAreCurrent = false;
    calculateItemsInView(ctx, { dataChanged: true, doMVCP: true });

    if (state.pendingEndMeasurements?.size) {
        const removedMeasurements = new Set(state.pendingEndMeasurements);
        for (let index = 0; index < dataProp.length && removedMeasurements.size; index++) {
            removedMeasurements.delete(getId(state, index));
        }
        for (const key of removedMeasurements) {
            state.pendingEndMeasurements.delete(key);
        }
    }

    const shouldMaintainScrollAtEnd = shouldMaintainScrollAtEndOnDataChange(state, didColumnsChange);
    if (
        shouldMaintainScrollAtEnd &&
        !maintainScrollAtEnd?.onItemLayout &&
        previousData &&
        dataProp.length > previousData.length
    ) {
        state.pendingEndMeasurements ??= new Set();
        for (let index = previousData.length; index < dataProp.length; index++) {
            const key = getId(state, index);
            if (!state.sizesKnown.has(key)) state.pendingEndMeasurements.add(key);
        }
    }

    const didMaintainScrollAtEnd = shouldMaintainScrollAtEnd && doMaintainScrollAtEnd(ctx);
    if (!didMaintainScrollAtEnd && !state.pendingMaintainScrollAtEnd) {
        state.pendingEndMeasurements = undefined;
    }

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
