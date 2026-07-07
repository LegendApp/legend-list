import { type UpdateItemPositionsOptions, updateArrayItemPositions } from "@/core/arrayLayout";
import type { StateContext } from "@/state/state";

export function updateItemPositions(
    ctx: StateContext,
    dataChanged: boolean | undefined,
    options?: UpdateItemPositionsOptions,
) {
    updateArrayItemPositions(ctx, dataChanged, options);
}
