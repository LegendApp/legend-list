import type React from "react";

import { getDataItem } from "@/core/IndexedData";
import { peek$, type StateContext } from "@/state/state";
import { isNullOrUndefined } from "@/utils/helpers";

export function getRenderedItem(ctx: StateContext, key: string, containerId: number) {
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
        const sharedItemProps = {
            extraData,
            index,
            item,
            type: useAssignedGeneration
                ? (metadata.itemType ?? "")
                : item !== undefined && getItemType ? (getItemType(item, index) ?? "") : "",
        };
        const itemProps =
            dataSource
                ? { ...sharedItemProps, dataSource: dataSource! }
                : { ...sharedItemProps, data };

        renderedItem = renderItem(itemProps) as React.ReactNode;
    }

    return { index, item, renderedItem };
}
