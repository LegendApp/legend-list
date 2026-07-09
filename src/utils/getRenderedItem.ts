import type React from "react";

import { getDataItem, getIndexedData } from "@/core/IndexedData";
import { peek$, type StateContext } from "@/state/state";
import { isNullOrUndefined } from "@/utils/helpers";

export function getRenderedItem(ctx: StateContext, key: string) {
    const state = ctx.state;
    if (!state) {
        return null;
    }
    if (!state.props.dataSource && !state.props.data) {
        throw new TypeError("LegendList data is unavailable");
    }

    const {
        indexByKey,
        props: { dataSource, getItemType, renderItem },
    } = state;

    const index = indexByKey.get(key);

    if (index === undefined) {
        return null;
    }

    let renderedItem: React.ReactNode = null;

    const extraData = peek$(ctx, "extraData");

    const indexedData = getIndexedData(state);
    const item = getDataItem(state, index);
    const shouldRender = indexedData.kind === "dataSource" || !isNullOrUndefined(item);
    if (renderItem && shouldRender) {
        const sharedItemProps = {
            extraData,
            index,
            item,
            type: item !== undefined && getItemType ? (getItemType(item, index) ?? "") : "",
        };
        const itemProps =
            indexedData.kind === "dataSource"
                ? { ...sharedItemProps, dataSource: dataSource! }
                : { ...sharedItemProps, data: indexedData.getLegacyData()! };

        renderedItem = renderItem(itemProps) as React.ReactNode;
    }

    return { index, item, renderedItem };
}
