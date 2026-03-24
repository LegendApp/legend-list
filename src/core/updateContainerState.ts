import { POSITION_OUT_OF_VIEW } from "@/constants";
import { peek$, type StateContext, set$ } from "@/state/state";
import { getId } from "@/utils/getId";
import { findAvailableContainers } from "@/utils/findAvailableContainers";

type RequiredItemTypeState = Pick<StateContext["state"], "props">;

export function getRequiredItemTypes(
    state: RequiredItemTypeState,
    data: readonly unknown[],
    indices: readonly number[],
) {
    const getItemType = state.props.getItemType;
    if (!getItemType) {
        return undefined;
    }

    return indices.map((index) => {
        const itemType = getItemType(data[index], index);
        return itemType !== undefined ? String(itemType) : "";
    });
}

export function syncContainerPoolSize(ctx: StateContext, numContainers: number) {
    if (numContainers === peek$(ctx, "numContainers")) {
        return;
    }

    set$(ctx, "numContainers", numContainers);
    if (numContainers > (peek$(ctx, "numContainersPooled") ?? 0)) {
        set$(ctx, "numContainersPooled", Math.ceil(numContainers * 1.5));
    }
}

export function allocateContainersForIndices(
    ctx: StateContext,
    params: {
        data: readonly unknown[];
        endBuffered: number;
        indices: readonly number[];
        pendingRemoval: number[];
        startBuffered: number;
        resolveAssignment?: (params: {
            containerIndex: number;
            index: number;
            itemType: string | undefined;
            order: number;
        }) => Omit<
            Parameters<typeof assignContainerItem>[1],
            "containerIndex" | "data" | "itemKey" | "itemType"
        >;
    },
) {
    const { data, endBuffered, indices, pendingRemoval, resolveAssignment, startBuffered } = params;
    if (indices.length === 0) {
        return peek$(ctx, "numContainers") ?? 0;
    }

    const state = ctx.state;
    const requiredItemTypes = getRequiredItemTypes(state, data, indices);
    const availableContainers = findAvailableContainers(
        ctx,
        indices.length,
        startBuffered,
        endBuffered,
        pendingRemoval,
        requiredItemTypes,
        indices,
    );

    let numContainers = peek$(ctx, "numContainers") ?? 0;
    for (let order = 0; order < indices.length; order++) {
        const index = indices[order];
        const containerIndex = availableContainers[order];
        assignContainerItem(ctx, {
            containerIndex,
            data: data[index],
            itemKey: state.idCache[index] ?? getId(state, index),
            itemType: requiredItemTypes?.[order],
            ...resolveAssignment?.({
                containerIndex,
                index,
                itemType: requiredItemTypes?.[order],
                order,
            }),
        });

        if (containerIndex >= numContainers) {
            numContainers = containerIndex + 1;
        }
    }

    syncContainerPoolSize(ctx, numContainers);
    return numContainers;
}

export function assignContainerItem(
    ctx: StateContext,
    params: {
        column?: number;
        containerIndex: number;
        data: unknown;
        itemKey: string;
        itemType?: string;
        keepInStickyPool?: boolean;
        position?: number;
        span?: number;
        sticky?: boolean;
    },
) {
    const {
        column = -1,
        containerIndex,
        data,
        itemKey,
        itemType,
        keepInStickyPool = false,
        position = POSITION_OUT_OF_VIEW,
        span = 1,
        sticky = false,
    } = params;
    const state = ctx.state;
    const oldKey = peek$(ctx, `containerItemKey${containerIndex}`);
    if (oldKey && oldKey !== itemKey) {
        state.containerItemKeys.delete(oldKey);
    }

    state.containerItemKeys.set(itemKey, containerIndex);
    if (itemType !== undefined) {
        state.containerItemTypes.set(containerIndex, itemType);
    }

    set$(ctx, `containerItemKey${containerIndex}`, itemKey);
    set$(ctx, `containerItemData${containerIndex}`, data);
    set$(ctx, `containerPosition${containerIndex}`, position);
    set$(ctx, `containerColumn${containerIndex}`, column);
    set$(ctx, `containerSpan${containerIndex}`, span);

    if (sticky) {
        set$(ctx, `containerSticky${containerIndex}`, true);
        state.stickyContainerPool.add(containerIndex);
    } else {
        if (peek$(ctx, `containerSticky${containerIndex}`)) {
            set$(ctx, `containerSticky${containerIndex}`, false);
        }

        if (keepInStickyPool) {
            state.stickyContainerPool.add(containerIndex);
        } else {
            state.stickyContainerPool.delete(containerIndex);
        }
    }
}

export function clearContainerItem(ctx: StateContext, containerIndex: number) {
    const state = ctx.state;
    const itemKey = peek$(ctx, `containerItemKey${containerIndex}`);
    if (itemKey !== undefined) {
        state.containerItemKeys.delete(itemKey);
    }

    state.containerItemTypes.delete(containerIndex);
    if (state.stickyContainerPool.has(containerIndex)) {
        set$(ctx, `containerSticky${containerIndex}`, false);
        state.stickyContainerPool.delete(containerIndex);
    }

    set$(ctx, `containerItemKey${containerIndex}`, undefined);
    set$(ctx, `containerItemData${containerIndex}`, undefined);
    set$(ctx, `containerPosition${containerIndex}`, POSITION_OUT_OF_VIEW);
    set$(ctx, `containerColumn${containerIndex}`, -1);
    set$(ctx, `containerSpan${containerIndex}`, 1);
}
