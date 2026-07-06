import { ArrayLayoutEngine } from "@/core/ArrayLayoutEngine";
import { PrefixLayoutEngine } from "@/core/PrefixLayoutEngine";
import type { PrefixLayoutStore } from "@/core/PrefixLayoutStore";
import { getActivePrefixLayoutStore } from "@/core/prefixLayoutStoreLifecycle";
import type { StateContext } from "@/state/state";
import type { InternalState } from "@/types.internal";

export type LayoutEngineKind = "array" | "prefix";

export interface LayoutEngine {
    readonly kind: LayoutEngineKind;
    getEnd(index: number | undefined): number | undefined;
    getOffset(index: number | undefined): number | undefined;
    getSize(index: number | undefined): number | undefined;
    getSnapOffsets(indices: number[]): number[];
    getTotalSize(): number;
    recordMeasuredSize(index: number | undefined, key: string, size: number): boolean;
    syncTotalSize(): boolean;
}

export interface OffsetSearchLayoutEngine extends LayoutEngine {
    readonly kind: "prefix";
    findIndexAtOffset(offset: number): number | undefined;
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

export function createLayoutEngine(ctx: StateContext, state: InternalState = ctx.state): LayoutEngine {
    const store = getPrefixLayoutStoreForEngine(ctx, state);
    return store ? new PrefixLayoutEngine(ctx, store, state) : new ArrayLayoutEngine(ctx, state);
}
