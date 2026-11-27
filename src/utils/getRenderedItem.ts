import type React from "react";

import { getDataItem } from "@/core/IndexedData";
import { peek$, type StateContext } from "@/state/state";
import { isNullOrUndefined } from "@/utils/helpers";

export function getRenderedItem(ctx: StateContext, key: string, containerId: number, onReadIndex?: () => void) {
    const state = ctx.state;
    if (!state) {
        return null;
    }
    if (!state.props.dataSource && !state.props.data) {
        throw new TypeError("LegendList data is unavailable");
    }

    const metadata = state.containerItemMetadata.get(containerId);

    const useAssignedGeneration = metadata && metadata.dataChangeEpoch !== state.dataChangeEpoch;
    const {
        indexByKey,
        props: { data: currentData, dataSource: currentDataSource, getItemType, renderItem },
    } = state;
    const data = useAssignedGeneration ? metadata.data : currentData;
    const index = metadata?.itemIndex ?? indexByKey.get(key);

    if (index === undefined) {
        return null;
    }

    let renderedItem: React.ReactNode = null;

    const extraData = peek$(ctx, "extraData");

    const dataSource = useAssignedGeneration ? metadata.dataSource : currentDataSource;
    const item = useAssignedGeneration ? metadata.itemData : getDataItem(state, index);
    const shouldRender = !!dataSource || !isNullOrUndefined(item);
    if (renderItem && shouldRender) {
        const type = useAssignedGeneration
            ? (metadata.itemType ?? "")
            : item !== undefined && getItemType
              ? (getItemType(item, index) ?? "")
              : "";
        let isRendering = true;
        const sharedItemProps = {
            extraData,
            // Reads after render, such as in event handlers, see the item's current index.
            get index() {
                onReadIndex?.();
                return isRendering ? index : (state.indexByKey.get(key) ?? index);
            },
            item,
            type,
        };
        const itemProps = Object.assign(sharedItemProps, dataSource ? { dataSource } : { data });

        renderedItem = renderItem(itemProps) as React.ReactNode;
        isRendering = false;
        return { index, item, renderedItem, type };
    }

    return { index, item, renderedItem };
}
