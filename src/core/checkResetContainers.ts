import { calculateItemsInView } from "@/core/calculateItemsInView";
import { doMaintainScrollAtEnd } from "@/core/doMaintainScrollAtEnd";
import { getDataLength } from "@/core/IndexedData";
import { clearLayoutStoreKnownSizes } from "@/core/layoutStoreLifecycle";
import type { StateContext } from "@/state/state";
import { checkThresholds } from "@/utils/checkThresholds";

interface CheckResetContainersOptions {
    didColumnsChange?: boolean;
    previousDataLength?: number;
}

export function checkResetContainers(
    ctx: StateContext,
    dataProp: readonly unknown[],
    { didColumnsChange = false, previousDataLength }: CheckResetContainersOptions = {},
) {
    const state = ctx.state;
    const { previousData } = state;
    const { maintainScrollAtEnd } = state.props;

    if (didColumnsChange) {
        state.sizes.clear();
        state.sizesKnown.clear();
        for (const key in state.averageSizes) {
            delete state.averageSizes[key];
        }
        clearLayoutStoreKnownSizes(ctx);
        state.minIndexSizeChanged = 0;
        state.scrollForNextCalculateItemsInView = undefined;
    }

    calculateItemsInView(ctx, { dataChanged: true, doMVCP: true });

    const shouldMaintainScrollAtEnd = !didColumnsChange && maintainScrollAtEnd?.onDataChange;

    const didMaintainScrollAtEnd = shouldMaintainScrollAtEnd && doMaintainScrollAtEnd(ctx);

    // Reset the endReached flag if new data has been added and we didn't
    // just maintain the scroll at end
    const previousLength = previousData?.length ?? previousDataLength;
    const currentLength = state.props.dataSource ? getDataLength(state) : dataProp.length;
    if (!didMaintainScrollAtEnd && previousLength !== undefined && currentLength > previousLength) {
        state.isEndReached = false;
    }

    if (!didMaintainScrollAtEnd) {
        checkThresholds(ctx);
    }

    delete state.previousData;
}
