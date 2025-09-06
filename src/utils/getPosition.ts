import { ensurePositionCalculated } from "@/core/updateItemPositions";
import type { StateContext } from "@/state/state";
import type { InternalState } from "@/types";
import { getId } from "@/utils/getId";

/**
 * Safely gets a position for an item by index, ensuring positions are calculated if needed.
 * This function handles range checking and on-demand position calculation.
 */
export function getPositionByIndex(ctx: StateContext, state: InternalState, index: number): number | undefined {
    ensurePositionCalculated(ctx, state, index);
    const id = getId(state, index);
    return id ? state.positions.get(id) : undefined;
}

/**
 * Safely gets a position for an item by ID, ensuring positions are calculated if needed.
 * This function handles range checking and on-demand position calculation.
 */
export function getPositionById(ctx: StateContext, state: InternalState, id: string): number | undefined {
    const index = state.indexByKey.get(id);
    if (index === undefined) {
        return state.positions.get(id);
    }
    ensurePositionCalculated(ctx, state, index);
    return state.positions.get(id);
}
