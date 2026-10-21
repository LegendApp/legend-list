import { calculateItemsInView } from "@/core/calculateItemsInView";
import { doMaintainScrollAtEnd } from "@/core/doMaintainScrollAtEnd";
import { resetColumnLayoutCaches } from "@/core/resetLayoutCachesForDataChange";
import { scrollElementIntoView } from "@/core/scrollElementIntoView";
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
        resetColumnLayoutCaches(state);
    }

    calculateItemsInView(ctx, { dataChanged: true, doMVCP: true });
    if (state.scrollElementTarget)
        state.scheduledWork.microtask(() => scrollElementIntoView(ctx, false), "scrollElementTarget");

    const isAppend =
        maintainScrollAtEnd?.onDataChange === "append" &&
        !!previousData &&
        dataProp.length > previousData.length &&
        previousData.every((item, index) => {
            const key = state.props.keyExtractor?.(item, index) ?? index;
            return key === getId(state, index);
        });
    const shouldMaintainScrollAtEnd =
        !didColumnsChange &&
        maintainScrollAtEnd?.onDataChange &&
        (maintainScrollAtEnd.onDataChange !== "append" || isAppend);
    if (
        shouldMaintainScrollAtEnd &&
        !maintainScrollAtEnd.onItemLayout &&
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
