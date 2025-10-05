import { IsNewArchitecture, POSITION_OUT_OF_VIEW } from "@/constants";
import { calculateItemsInView } from "@/core/calculateItemsInView";
import { peek$, type StateContext, set$ } from "@/state/state";
import type { InternalState } from "@/types";

export function doInitialAllocateContainers(ctx: StateContext, state: InternalState): boolean | undefined {
    // Allocate containers
    const {
        scrollLength,
        props: {
            data,
            getEstimatedItemSize,
            getFixedItemSize,
            getItemType,
            scrollBuffer,
            numColumns,
            estimatedItemSize,
        },
    } = state;

    const hasContainers = peek$(ctx, "numContainers");

    if (scrollLength > 0 && data.length > 0 && !hasContainers) {
        let averageItemSize: number;
        const fn = getFixedItemSize || getEstimatedItemSize;
        if (fn) {
            let totalSize = 0;
            const num = Math.min(20, data.length);
            for (let i = 0; i < num; i++) {
                const item = data[i];
                const itemType = getItemType ? (getItemType(item, i) ?? "") : "";
                totalSize += fn(i, item, itemType);
            }
            averageItemSize = totalSize / num;
        } else {
            averageItemSize = estimatedItemSize!;
        }
        const numContainers = Math.ceil(((scrollLength + scrollBuffer * 2) / averageItemSize!) * numColumns);

        for (let i = 0; i < numContainers; i++) {
            set$(ctx, `containerPosition${i}`, POSITION_OUT_OF_VIEW);
            set$(ctx, `containerColumn${i}`, -1);
        }

        set$(ctx, "numContainers", numContainers);
        set$(ctx, "numContainersPooled", numContainers * state.props.initialContainerPoolRatio);

        if (!IsNewArchitecture || state.lastLayout) {
            if (state.props.initialScroll) {
                requestAnimationFrame(() => {
                    // immediate render causes issues with initial index position
                    calculateItemsInView(ctx, state, { dataChanged: true });
                });
            } else {
                calculateItemsInView(ctx, state, { dataChanged: true });
            }
        }

        return true;
    }
}
