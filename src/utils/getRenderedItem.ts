import type React from "react";

import { peek$, type StateContext } from "@/state/state";
import { isNullOrUndefined } from "@/utils/helpers";

export function getRenderedItem(ctx: StateContext, key: string, containerId: number) {
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
        const itemProps = {
            data,
            extraData,
            index,
            item,
            type: useAssignedGeneration
                ? (metadata.itemType ?? "")
                : getItemType
                  ? (getItemType(item, index) ?? "")
                  : "",
        };

        renderedItem = renderItem(itemProps) as React.ReactNode;
    }

    return { index, item, renderedItem };
}
