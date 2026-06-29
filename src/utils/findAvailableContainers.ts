import { peek$, type StateContext } from "@/state/state";
import { IS_DEV } from "@/utils/devEnvironment";

export interface ContainerAllocation {
    containerIndex: number;
    itemIndex: number;
    itemType?: string;
}

interface AvailableContainer {
    distance: number;
    index: number;
}

export function findAvailableContainers(
    ctx: StateContext,
    needNewContainers: number[],
    startBuffered: number,
    endBuffered: number,
    pendingRemoval: number[],
    getRequiredItemType?: (itemIndex: number) => string | undefined,
    protectedKeys?: Set<string>,
): ContainerAllocation[] {
    const numNeeded = needNewContainers.length;
    if (numNeeded === 0) {
        return [];
    }

    const numContainers = peek$(ctx, "numContainers");
    const state = ctx.state;

    const { stickyContainerPool, containerItemTypes } = state;
    const shouldAvoidAssignedContainerReuse = state.props.recycleItems && !!state.props.positionComponentInternal;

    const allocations: ContainerAllocation[] = [];

    const pendingRemovalSet = pendingRemoval.length > 0 ? new Set(pendingRemoval) : undefined;
    let pendingRemovalChanged = false;
    let nextNewContainerIndex = numContainers;
    const usedContainers = new Set<number>();
    let availableContainers: AvailableContainer[] | undefined;

    const stickyHeaderIndicesSet = state.props.stickyHeaderIndicesSet;

    // Helper function to check if a container can be reused for a given item type
    const canReuseContainer = (containerIndex: number, requiredType: string | undefined): boolean => {
        if (!requiredType) return true; // No type requirement, can reuse any container

        const existingType = containerItemTypes.get(containerIndex);
        if (!existingType) return true; // Untyped container can be reused for any type

        return existingType === requiredType;
    };

    const pushAllocation = (itemIndex: number, itemType: string | undefined, containerIndex: number) => {
        allocations.push({
            containerIndex,
            itemIndex,
            itemType,
        });
        usedContainers.add(containerIndex);
        if (pendingRemovalSet?.delete(containerIndex)) {
            pendingRemovalChanged = true;
        }
    };

    const pushNewContainer = (itemIndex: number, itemType: string | undefined, isSticky: boolean) => {
        const newContainerIndex = nextNewContainerIndex++;
        pushAllocation(itemIndex, itemType, newContainerIndex);
        if (isSticky) {
            stickyContainerPool.add(newContainerIndex);
        }
        return newContainerIndex;
    };

    const canUseContainer = (containerIndex: number, itemType: string | undefined) => {
        if (usedContainers.has(containerIndex) || stickyContainerPool.has(containerIndex)) {
            return false;
        }
        const key = peek$(ctx, `containerItemKey${containerIndex}`);
        const isPending = !!pendingRemovalSet?.has(containerIndex);
        return (key === undefined || isPending) && canReuseContainer(containerIndex, itemType);
    };

    const findStickyContainer = (itemType: string | undefined) => {
        let foundContainer: number | undefined;
        for (const containerIndex of stickyContainerPool) {
            if (!usedContainers.has(containerIndex)) {
                const key = peek$(ctx, `containerItemKey${containerIndex}`);
                const isPendingRemoval = !!pendingRemovalSet?.has(containerIndex);
                if ((key === undefined || isPendingRemoval) && canReuseContainer(containerIndex, itemType)) {
                    foundContainer = containerIndex;
                    break;
                }
            }
        }
        return foundContainer;
    };

    const findUnassignedOrPendingContainer = (itemType: string | undefined) => {
        let foundContainer: number | undefined;

        for (let containerIndex = 0; containerIndex < numContainers && foundContainer === undefined; containerIndex++) {
            if (canUseContainer(containerIndex, itemType)) {
                foundContainer = containerIndex;
            }
        }

        return foundContainer;
    };

    const getAvailableContainers = () => {
        if (!availableContainers) {
            availableContainers = [];

            if (!shouldAvoidAssignedContainerReuse) {
                for (let containerIndex = 0; containerIndex < numContainers; containerIndex++) {
                    if (usedContainers.has(containerIndex) || stickyContainerPool.has(containerIndex)) {
                        continue;
                    }

                    const key = peek$(ctx, `containerItemKey${containerIndex}`);
                    if (key === undefined) continue;
                    if (protectedKeys?.has(key) && state.indexByKey.has(key)) continue;

                    const index = state.indexByKey.get(key)!;
                    const isOutOfView = index < startBuffered || index > endBuffered;
                    if (isOutOfView) {
                        const distance = index < startBuffered ? startBuffered - index : index - endBuffered;
                        availableContainers.push({ distance, index: containerIndex });
                    }
                }

                availableContainers.sort(comparatorByDistance);
            }
        }

        return availableContainers;
    };

    const findAvailableContainer = (itemType: string | undefined) => {
        const containers = getAvailableContainers();
        let matchIndex = -1;

        for (let i = 0; i < containers.length && matchIndex === -1; i++) {
            const containerIndex = containers[i].index;
            if (!usedContainers.has(containerIndex) && canReuseContainer(containerIndex, itemType)) {
                matchIndex = i;
            }
        }

        return matchIndex === -1 ? undefined : containers.splice(matchIndex, 1)[0].index;
    };

    for (const itemIndex of needNewContainers) {
        const itemType = getRequiredItemType?.(itemIndex);
        const isSticky = stickyHeaderIndicesSet.has(itemIndex);
        let containerIndex: number | undefined;

        if (isSticky) {
            containerIndex = findStickyContainer(itemType);
        } else {
            containerIndex = findUnassignedOrPendingContainer(itemType);
            if (containerIndex === undefined) {
                containerIndex = findAvailableContainer(itemType);
            }
        }

        if (containerIndex !== undefined) {
            pushAllocation(itemIndex, itemType, containerIndex);
        } else {
            pushNewContainer(itemIndex, itemType, isSticky);
        }
    }

    if (pendingRemovalChanged) {
        pendingRemoval.length = 0;
        if (pendingRemovalSet) {
            for (const value of pendingRemovalSet) {
                pendingRemoval.push(value);
            }
        }
    }

    if (IS_DEV && nextNewContainerIndex > peek$(ctx, "numContainersPooled")) {
        console.warn(
            "[legend-list] No unused container available, so creating one on demand. This can be a minor performance issue and is likely caused by the estimatedItemSize being too large. Consider decreasing estimatedItemSize.",
            {
                debugInfo: {
                    numContainers,
                    numContainersPooled: peek$(ctx, "numContainersPooled"),
                    numNeeded,
                    stillNeeded: nextNewContainerIndex - numContainers,
                },
            },
        );
    }

    return allocations;
}

function comparatorByDistance(a: AvailableContainer, b: AvailableContainer) {
    return b.distance - a.distance;
}
