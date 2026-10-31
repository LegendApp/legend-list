import type React from "react";

import { peek$, type StateContext } from "@/state/state";
import { isNullOrUndefined } from "@/utils/helpers";

export function getRenderedItem(ctx: StateContext, key: string, containerId: number, onReadIndex?: () => void) {
    const state = ctx.state;
    if (!state) {
        return null;
    }

    const metadata = state.containerItemMetadata.get(containerId);

    const useAssignedGeneration = metadata && metadata.dataChangeEpoch !== state.dataChangeEpoch;
    const {
        indexByKey,
        props: { data: currentData, getItemType, renderItem },
    } = state;
    const data = useAssignedGeneration ? metadata.data : currentData;
    const index = metadata?.itemIndex ?? indexByKey.get(key);

    if (index === undefined) {
        return null;
    }

    let renderedItem: React.ReactNode = null;

    const extraData = peek$(ctx, "extraData");

    const item = useAssignedGeneration ? metadata.itemData : data[index];
    if (renderItem && !isNullOrUndefined(item)) {
        let type = "";
        if (useAssignedGeneration) {
            type = metadata.itemType ?? "";
        } else if (getItemType) {
            type = getItemType(item, index) ?? "";
        }
        let isRendering = true;
        const itemProps = {
            data,
            extraData,
            // Reads after render, such as in event handlers, see the item's current index.
            get index() {
                onReadIndex?.();
                return isRendering ? index : (state.indexByKey.get(key) ?? index);
            },
            item,
            type,
        };

        renderedItem = renderItem(itemProps) as React.ReactNode;
        isRendering = false;
        return { index, item, renderedItem, type };
    }

    return { index, item, renderedItem };
}
