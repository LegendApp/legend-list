// biome-ignore lint/style/useImportType: Leaving this out makes it crash in some environments
import * as React from "react";

import { useIsLastItem } from "@/state/ContextContainer";

export interface SeparatorProps<ItemT> {
    ItemSeparatorComponent: React.ComponentType<{ leadingItem: ItemT }>;
    leadingItem: ItemT;
}

export function Separator<ItemT>({ ItemSeparatorComponent, leadingItem }: SeparatorProps<ItemT>) {
    const isLastItem = useIsLastItem();

    return isLastItem ? null : <ItemSeparatorComponent leadingItem={leadingItem} />;
}
