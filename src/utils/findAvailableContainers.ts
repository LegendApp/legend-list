import { peek$, type StateContext } from "@/state/state";
import { IS_DEV } from "@/utils/devEnvironment";

export interface ContainerAllocation {
    containerIndex: number;
    itemIndex: number;
    itemType?: string;
}

interface AvailableContainer {
    containerIndex: number;
    distance: number;
}

interface RequestedContainer {
    isBuffered: boolean;
    isSticky: boolean;
    itemIndex: number;
    itemType?: string;
    order: number;
    renderPriority: number;
}

// Allocate the whole request batch together rather than greedily assigning each item.
// This lets every request claim an exact-type container before earlier requests can
// consume those containers through untyped or cross-type reuse. Normal and sticky
// pools stay separate, and only requests that cannot reuse a candidate grow the pool.
export function findAvailableContainers(
    ctx: StateContext,
    needNewContainers: number[],
    startBuffered: number,
    endBuffered: number,
    pendingRemoval: number[],
    protectedKeys?: Set<string>,
    reverseItemOrder = false,
): ContainerAllocation[] {
    const numNeeded = needNewContainers.length;
    if (numNeeded === 0) {
        return [];
    }

    const numContainers = peek$(ctx, "numContainers");
    const state = ctx.state;
    const { containerItemMetadata, stickyContainerPool } = state;
    const { data, getItemType } = state.props;
    const hasItemTypes = !!getItemType;
    const shouldAvoidAssignedContainerReuse = state.props.recycleItems && !!state.props.positionComponentInternal;
    const pendingRemovalSet = pendingRemoval.length > 0 ? new Set(pendingRemoval) : undefined;

    const requests = new Array<RequestedContainer>(numNeeded);
    const normalRequests: RequestedContainer[] = [];
    const stickyRequests: RequestedContainer[] = [];
    for (let order = 0; order < numNeeded; order++) {
        const itemIndex = needNewContainers[order];
        const itemType = getItemType?.(data[itemIndex], itemIndex);
        const request: RequestedContainer = {
            isBuffered: itemIndex >= startBuffered && itemIndex <= endBuffered,
            isSticky: state.props.stickyHeaderIndicesSet.has(itemIndex),
            itemIndex,
            itemType: hasItemTypes ? (itemType !== undefined ? String(itemType) : "") : undefined,
            order,
            renderPriority: reverseItemOrder ? -itemIndex : itemIndex,
        };
        requests[order] = request;
        (request.isSticky ? stickyRequests : normalRequests).push(request);
    }
    const normalCandidates: AvailableContainer[] = [];
    const stickyCandidates: AvailableContainer[] = [];

    // Unassigned and pending-removal containers are immediately reusable, so they
    // sort ahead with an infinite distance. Assigned normal containers are eligible
    // only outside the buffered range and are ranked farthest-first to avoid stealing
    // a container that may soon re-enter the viewport. Assigned reuse is disabled while
    // recycled layout animations may still need the outgoing view. Sticky containers
    // never leave their dedicated pool, and active or protected containers are excluded.
    for (let containerIndex = 0; containerIndex < numContainers; containerIndex++) {
        const key = peek$(ctx, `containerItemKey${containerIndex}`);
        const isPendingRemoval = !!pendingRemovalSet?.has(containerIndex);
        const isProtected = !!key && !!protectedKeys?.has(key) && state.indexByKey.has(key);

        if (isProtected) {
            continue;
        }

        if (stickyContainerPool.has(containerIndex)) {
            if (key === undefined || isPendingRemoval) {
                stickyCandidates.push({ containerIndex, distance: Number.POSITIVE_INFINITY });
            }
        } else if (key === undefined || isPendingRemoval) {
            normalCandidates.push({ containerIndex, distance: Number.POSITIVE_INFINITY });
        } else if (!shouldAvoidAssignedContainerReuse) {
            const index = state.indexByKey.get(key);
            if (index !== undefined && (index < startBuffered || index > endBuffered)) {
                const distance = index < startBuffered ? startBuffered - index : index - endBuffered;
                normalCandidates.push({ containerIndex, distance });
            }
        }
    }

    normalCandidates.sort(comparatorByDistance);
    const allocations = new Array<ContainerAllocation>(numNeeded);
    let nextNewContainerIndex = numContainers;
    let pendingRemovalChanged = false;

    const assign = (request: RequestedContainer, containerIndex: number) => {
        allocations[request.order] = {
            containerIndex,
            itemIndex: request.itemIndex,
            itemType: request.itemType,
        };
        if (pendingRemovalSet?.delete(containerIndex)) {
            pendingRemovalChanged = true;
        }
    };

    const assignMatching = (
        pendingRequests: RequestedContainer[],
        candidates: AvailableContainer[],
        matches: (containerType: string | undefined, requestType: string | undefined) => boolean,
    ) => {
        for (const request of pendingRequests) {
            if (allocations[request.order]) {
                continue;
            }

            const candidateIndex = candidates.findIndex((candidate) =>
                matches(containerItemMetadata.get(candidate.containerIndex)?.itemType, request.itemType),
            );
            if (candidateIndex !== -1) {
                const [candidate] = candidates.splice(candidateIndex, 1);
                assign(request, candidate.containerIndex);
            }
        }
    };

    const assignFromPool = (
        pendingRequests: RequestedContainer[],
        candidates: AvailableContainer[],
        allowCrossType: boolean,
    ) => {
        // Run each matching class across the whole batch before moving to the next.
        // Otherwise an early request could retype the exact container needed by a
        // later request. Sticky pools skip the cross-type pass so a mismatched sticky
        // request grows a new type-owned slot instead of retyping an existing one.
        if (hasItemTypes) {
            assignMatching(
                pendingRequests,
                candidates,
                (containerType, requestType) => requestType !== undefined && containerType === requestType,
            );
        }
        assignMatching(pendingRequests, candidates, (containerType) => containerType === undefined);
        if (allowCrossType) {
            assignMatching(pendingRequests, candidates, () => true);
        }
    };

    assignFromPool(normalRequests, normalCandidates, true);
    assignFromPool(stickyRequests, stickyCandidates, false);

    // Reusable capacity is exhausted at this point. Growing beyond the preallocated
    // budget is valid when no eligible candidate remains, such as during concurrent
    // active/protected demand or a sticky type mismatch. The development warning below
    // makes that exceptional cost visible.
    for (const request of requests) {
        if (allocations[request.order]) {
            continue;
        }

        const containerIndex = nextNewContainerIndex++;
        if (request.isSticky) {
            stickyContainerPool.add(containerIndex);
        }
        assign(request, containerIndex);
    }

    // Selection above preserves distance preference and reserves exact-type slots.
    // Now pair compatible requests with the selected slots in React child order.
    // Swapping only within a requested type/pool preserves every type match and
    // keeps sticky slots separate, including newly grown slots.
    if (normalRequests.length > 1 || stickyRequests.length > 1) {
        const containerIndices: number[] = [];
        reorderPoolAssignments(normalRequests, allocations, containerIndices, hasItemTypes);
        reorderPoolAssignments(stickyRequests, allocations, containerIndices, hasItemTypes);
    }

    if (pendingRemovalChanged) {
        // The caller owns this queue. Reusing a pending-removal container cancels only
        // that removal while preserving the order of every untouched entry.
        pendingRemoval.length = 0;
        if (pendingRemovalSet) {
            for (const value of pendingRemovalSet) {
                pendingRemoval.push(value);
            }
        }
    }

    if (IS_DEV) {
        const numContainersPooled = peek$(ctx, "numContainersPooled") ?? Number.POSITIVE_INFINITY;
        if (nextNewContainerIndex > numContainersPooled) {
            console.warn(
                "[legend-list] No unused container available, so creating one on demand. This can be a minor performance issue and is likely caused by the estimatedItemSize being too large. Consider decreasing estimatedItemSize.",
                {
                    debugInfo: {
                        numContainers,
                        numContainersPooled,
                        numNeeded,
                        stillNeeded: nextNewContainerIndex - numContainers,
                    },
                },
            );
        }
    }

    return allocations;
}

function comparatorByDistance(a: AvailableContainer, b: AvailableContainer) {
    return b.distance - a.distance;
}

function comparatorByRenderPriority(a: RequestedContainer, b: RequestedContainer) {
    // Buffered rows precede distant pins; signed priority supplies the scroll direction.
    return Number(b.isBuffered) - Number(a.isBuffered) || a.renderPriority - b.renderPriority;
}

function comparatorByIndex(a: number, b: number) {
    return a - b;
}

function reorderPoolAssignments(
    requests: RequestedContainer[],
    allocations: ContainerAllocation[],
    containerIndices: number[],
    groupByType: boolean,
) {
    if (requests.length >= 2) {
        // Without getItemType, the whole pool is already one compatible group.
        if (groupByType) {
            const groups = new Map<string | undefined, RequestedContainer[]>();
            for (const request of requests) {
                const group = groups.get(request.itemType);
                if (group) {
                    group.push(request);
                } else {
                    groups.set(request.itemType, [request]);
                }
            }
            for (const group of groups.values()) {
                reorderPoolAssignments(group, allocations, containerIndices, false);
            }
        } else {
            containerIndices.length = 0;
            let indicesSorted = true;
            for (let i = 0; i < requests.length; i++) {
                const containerIndex = allocations[requests[i].order].containerIndex;
                if (i > 0 && containerIndex < containerIndices[i - 1]) {
                    indicesSorted = false;
                }
                containerIndices.push(containerIndex);
            }
            if (!indicesSorted) {
                containerIndices.sort(comparatorByIndex);
            }
            requests.sort(comparatorByRenderPriority);
            for (let i = 0; i < requests.length; i++) {
                allocations[requests[i].order].containerIndex = containerIndices[i];
            }
        }
    }
}
