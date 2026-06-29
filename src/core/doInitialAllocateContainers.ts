import { POSITION_OUT_OF_VIEW } from "@/constants";
import { IsNewArchitecture } from "@/constants-platform";
import { calculateItemsInView } from "@/core/calculateItemsInView";
import { peek$, type StateContext, set$ } from "@/state/state";
import { getInitialContainerPoolSize } from "@/utils/containerPool";
import { getEffectiveDrawDistance } from "@/utils/getEffectiveDrawDistance";

export function doInitialAllocateContainers(ctx: StateContext): boolean | undefined {
    // Allocate containers
    const state = ctx.state;
    const {
        scrollLength,
        props: { data, getFixedItemSize, getItemType, numColumns, estimatedItemSize },
    } = state;
    const drawDistance = getEffectiveDrawDistance(ctx);

    const hasContainers = peek$(ctx, "numContainers");

    if (scrollLength > 0 && data.length > 0 && !hasContainers) {
        let averageItemSize: number;
        if (getFixedItemSize) {
            let totalSize = 0;
            const num = Math.min(20, data.length);
            for (let i = 0; i < num; i++) {
                const item = data[i];
                if (item !== undefined) {
                    const itemType = getItemType?.(item, i) ?? "";
                    totalSize += (getFixedItemSize(item, i, itemType) ?? estimatedItemSize)! + ctx.scrollAxisGap;
                }
            }
            averageItemSize = totalSize / num;
        } else {
            averageItemSize = estimatedItemSize! + ctx.scrollAxisGap;
        }
        const numContainers = Math.max(
            1,
            Math.ceil(((scrollLength + drawDistance * 2) / averageItemSize!) * numColumns),
        );

        for (let i = 0; i < numContainers; i++) {
            set$(ctx, `containerPosition${i}`, POSITION_OUT_OF_VIEW);
            set$(ctx, `containerColumn${i}`, -1);
            set$(ctx, `containerSpan${i}`, 1);
        }

        set$(ctx, "numContainers", numContainers);
        set$(ctx, "numContainersPooled", getInitialContainerPoolSize(data.length, numContainers));

        if (!IsNewArchitecture || state.lastLayout) {
            if (state.initialScroll) {
                requestAnimationFrame(() => {
                    // immediate render causes issues with initial index position
                    calculateItemsInView(ctx, { dataChanged: true, doMVCP: true });
                });
            } else {
                calculateItemsInView(ctx, { dataChanged: true, doMVCP: true });
            }
        }

        return true;
    }
}
