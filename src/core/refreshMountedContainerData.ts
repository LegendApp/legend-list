import type { StateContext } from "@/state/state";

import { syncMountedContainer } from "@/core/syncMountedContainer";

export function refreshMountedContainerData(ctx: StateContext) {
    const state = ctx.state;
    const {
        containerItemKeys,
        props: { data, keyExtractor },
    } = state;

    if (!keyExtractor) {
        return;
    }

    for (const [itemKey, containerIndex] of containerItemKeys) {
        const itemIndex = state.indexByKey.get(itemKey);
        if (itemIndex === undefined) {
            continue;
        }

        const item = data[itemIndex];
        if (item === undefined || keyExtractor(item, itemIndex) !== itemKey) {
            continue;
        }

        syncMountedContainer(ctx, containerIndex, itemIndex, { updateLayout: false });
    }
}
