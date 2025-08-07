import { IsNewArchitecture, POSITION_OUT_OF_VIEW } from "@/constants";
import { calculateItemsInView } from "@/core/calculateItemsInView";
import { batchedUpdates } from "@/platform/BatchedUpdates";
import { peek$, type StateContext, set$ } from "@/state/state";
import type { InternalState } from "@/types";

export function doInitialAllocateContainers(ctx: StateContext, state: InternalState): boolean | undefined {
    // Allocate containers
    const {
        scrollLength,
        props: { data, getEstimatedItemSize, getItemType, scrollBuffer, numColumns, estimatedItemSize },
    } = state;
    if (scrollLength > 0 && data.length > 0 && !peek$(ctx, "numContainers")) {
        const averageItemSize = getEstimatedItemSize
            ? getEstimatedItemSize(0, data[0], getItemType ? (getItemType(data[0], 0) ?? "") : "")
            : estimatedItemSize;
        const numContainers = Math.ceil(((scrollLength + scrollBuffer * 2) / averageItemSize!) * numColumns);

        // Batch initial container signals to avoid N intermediate renders
        batchedUpdates(() => {
            for (let i = 0; i < numContainers; i++) {
                set$(ctx, `containerPosition${i}`, POSITION_OUT_OF_VIEW);
                set$(ctx, `containerColumn${i}`, -1);
            }

            set$(ctx, "numContainers", numContainers);
            // Smaller pool on web initially; progressively warm up after first paint
            const poolRatio = state.props.initialContainerPoolRatio;
            const pooled = Math.ceil(
                numContainers * (typeof window !== "undefined" ? Math.min(1.2, poolRatio) : poolRatio),
            );
            set$(ctx, "numContainersPooled", pooled);
        });

        if (!IsNewArchitecture) {
            if (state.props.initialScroll) {
                requestAnimationFrame(() => {
                    // immediate render causes issues with initial index position
                    calculateItemsInView(ctx, state);
                });
            } else {
                calculateItemsInView(ctx, state);
            }
        }

        // Progressive warm-up: increase pool size gradually after first paint on web
        if (typeof window !== "undefined") {
            requestAnimationFrame(() => {
                const targetPool = Math.ceil(numContainers * state.props.initialContainerPoolRatio);
                const currentPool = peek$(ctx, "numContainersPooled") || 0;
                if (currentPool < targetPool) {
                    set$(ctx, "numContainersPooled", targetPool);
                }
            });
        }

        return true;
    }
}
