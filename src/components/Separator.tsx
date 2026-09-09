// biome-ignore lint/style/useImportType: Leaving this out makes it crash in some environments
import * as React from "react";

import { useIsLastItem } from "@/state/ContextContainer";
import { useArr$ } from "@/state/state";
import type { LegendListItemSeparatorProps } from "@/types.base";

export interface SeparatorProps<ItemT> {
    containerId: number;
    ItemSeparatorComponent: React.ComponentType<LegendListItemSeparatorProps<ItemT>>;
    leadingItem: ItemT;
}

export function Separator<ItemT>({ containerId, ItemSeparatorComponent, leadingItem }: SeparatorProps<ItemT>) {
    const isLastItem = useIsLastItem();
    // The trailing item comes from its own signal so that the
    // separator updates when the next item changes,
    // which does not re-render this container.
    const [trailingItem] = useArr$([`containerItemTrailingData${containerId}`]);

    return isLastItem ? null : <ItemSeparatorComponent leadingItem={leadingItem} trailingItem={trailingItem} />;
}
