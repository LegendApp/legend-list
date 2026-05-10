// biome-ignore lint/style/useImportType: Leaving this out makes it crash in some environments
import * as React from "react";

import { Container } from "@/components/Container";
import { useArr$ } from "@/state/state";
import type { StickyHeaderConfig } from "@/types.base";
import { type GetRenderedItem, typedMemo } from "@/types.internal";

export interface ContainerComponentProps<ItemT> {
    horizontal: boolean;
    id: number;
    itemKey: string;
    recycleItems: boolean;
    ItemSeparatorComponent?: React.ComponentType<{ leadingItem: ItemT }>;
    updateItemSize: (itemKey: string, size: { width: number; height: number }) => void;
    getRenderedItem: GetRenderedItem;
    stickyHeaderConfig?: StickyHeaderConfig;
}

export interface ContainerSlotProps<ItemT> extends Omit<ContainerComponentProps<ItemT>, "itemKey"> {
    ContainerComponent?: React.ComponentType<ContainerComponentProps<ItemT>>;
}

export function ContainerSlotBase<ItemT>({
    id,
    horizontal,
    recycleItems,
    ItemSeparatorComponent,
    updateItemSize,
    getRenderedItem,
    stickyHeaderConfig,
    ContainerComponent = Container,
}: ContainerSlotProps<ItemT>) {
    const [itemKey] = useArr$([`containerItemKey${id}`]);

    if (itemKey === undefined) {
        return null;
    }

    return (
        <ContainerComponent
            getRenderedItem={getRenderedItem}
            horizontal={horizontal}
            ItemSeparatorComponent={ItemSeparatorComponent}
            id={id}
            itemKey={itemKey}
            recycleItems={recycleItems}
            stickyHeaderConfig={stickyHeaderConfig}
            updateItemSize={updateItemSize}
        />
    );
}

// biome-ignore lint/nursery/noShadow: const function name shadowing is intentional
export const ContainerSlot = typedMemo(function ContainerSlot<ItemT>(props: ContainerSlotProps<ItemT>) {
    return <ContainerSlotBase {...props} />;
});
