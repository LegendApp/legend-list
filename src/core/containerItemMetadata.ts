import type { ContainerItemMetadata, InternalState } from "@/types.internal";

export function createContainerItemMetadata(
    state: InternalState,
    itemIndex: number,
    itemData: any,
    itemType?: string,
): ContainerItemMetadata {
    return {
        data: state.props.data,
        dataChangeEpoch: state.dataChangeEpoch,
        getFixedItemSize: state.props.getFixedItemSize,
        getItemType: state.props.getItemType,
        itemData,
        itemIndex,
        itemType,
    };
}

export function updateContainerItemMetadata(
    state: InternalState,
    containerId: number,
    itemIndex: number,
    itemData: any,
    itemType?: string,
) {
    const { getItemType } = state.props;
    const previousMetadata = state.containerItemMetadata.get(containerId);
    if (
        previousMetadata?.dataChangeEpoch === state.dataChangeEpoch &&
        previousMetadata.getItemType === getItemType &&
        previousMetadata.itemData === itemData &&
        previousMetadata.itemIndex === itemIndex
    ) {
        return previousMetadata;
    }

    const resolvedItemType = itemType ?? (getItemType ? (getItemType(itemData, itemIndex) ?? "") : undefined);
    const metadata = createContainerItemMetadata(state, itemIndex, itemData, resolvedItemType);
    state.containerItemMetadata.set(containerId, metadata);
    return metadata;
}

export function resolveContainerItemMetadata(
    state: InternalState,
    containerId: number,
    itemIndex: number,
    itemData: any,
) {
    const { getFixedItemSize } = state.props;
    const metadata = updateContainerItemMetadata(state, containerId, itemIndex, itemData);

    if (metadata.getFixedItemSize !== getFixedItemSize) {
        metadata.didResolveFixedItemSize = false;
        metadata.fixedItemSize = undefined;
        metadata.getFixedItemSize = getFixedItemSize;
    }
    if (getFixedItemSize && !metadata.didResolveFixedItemSize) {
        // The flag also caches an intentional undefined result for dynamic items.
        metadata.fixedItemSize = getFixedItemSize(itemData, itemIndex, metadata.itemType ?? "");
        metadata.didResolveFixedItemSize = true;
    }

    return metadata;
}

export function invalidateContainerFixedItemSizes(state: InternalState) {
    for (const metadata of state.containerItemMetadata.values()) {
        metadata.didResolveFixedItemSize = false;
        metadata.fixedItemSize = undefined;
    }
}
