import React from "react";

import { peek$, type StateContext } from "@/state/state";
import { isNullOrUndefined } from "@/utils/helpers";

export function getRenderedItem(ctx: StateContext, key: string) {
    const state = ctx.state;
    if (!state) {
        return null;
    }

    const {
        indexByKey,
        props: { data, getItemType, renderItem },
    } = state;

    const index = indexByKey.get(key);

    if (index === undefined) {
        return null;
    }

    let renderedItem: React.ReactNode = null;

    const extraData = peek$(ctx, "extraData");

    const item = data[index];
    if (renderItem && !isNullOrUndefined(item)) {
        const itemProps = {
            data,
            extraData,
            index,
            item,
            type: getItemType ? (getItemType(item, index) ?? "") : "",
        };

        // Always render through React so function components can safely use Hooks.
        renderedItem = React.createElement(renderItem, itemProps) as React.ReactNode;
    }

    return { index, item: data[index], renderedItem };
}
