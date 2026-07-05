import type { PrefixLayoutStore } from "@/core/PrefixLayoutStore";
import { getActivePrefixLayoutStore } from "@/core/prefixLayoutStoreLifecycle";
import type { StateContext } from "@/state/state";
import type { InternalState } from "@/types.internal";

export type LayoutEngineKind = "array" | "prefix";

export interface LayoutEngine {
    readonly kind: LayoutEngineKind;
    findIndexAtOffset(offset: number): number | undefined;
    getEnd(index: number | undefined): number | undefined;
    getOffset(index: number | undefined): number | undefined;
    getSize(index: number | undefined): number | undefined;
    getSnapOffsets(indices: number[]): number[];
    getTotalSize(): number;
    recordMeasuredSize(index: number | undefined, key: string, size: number): boolean;
    syncTotalSize(): boolean;
}

export function getPrefixLayoutStoreForEngine(
    ctx: StateContext,
    state: InternalState = ctx.state,
): PrefixLayoutStore | undefined {
    return state === ctx.state ? getActivePrefixLayoutStore(ctx) : state.layoutStore;
}

export function getLayoutEngineKind(ctx: StateContext, state: InternalState = ctx.state): LayoutEngineKind {
    return getPrefixLayoutStoreForEngine(ctx, state) ? "prefix" : "array";
}
