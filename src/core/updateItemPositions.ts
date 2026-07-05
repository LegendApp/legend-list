import { ArrayLayoutEngine, type UpdateItemPositionsOptions } from "@/core/ArrayLayoutEngine";
import type { StateContext } from "@/state/state";

export function updateItemPositions(
    ctx: StateContext,
    dataChanged: boolean | undefined,
    options?: UpdateItemPositionsOptions,
) {
    new ArrayLayoutEngine(ctx).updateItemPositions(dataChanged, options);
}
