import type { StateContext } from "@/state/state";
import type { RequestAdjustOptions } from "@/typesInternal";

type RuntimeCallbacks = {
    requestAdjust?: (positionDiff: number, dataChanged?: boolean, options?: RequestAdjustOptions) => void;
    updateScroll?: (newScroll: number, forceUpdate?: boolean) => void;
};

const runtimeCallbacksByContext = new WeakMap<StateContext, RuntimeCallbacks>();

export function setRuntimeCallbacks(ctx: StateContext, callbacks: RuntimeCallbacks) {
    runtimeCallbacksByContext.set(ctx, callbacks);
}

export function runRuntimeRequestAdjust(
    ctx: StateContext,
    positionDiff: number,
    dataChanged?: boolean,
    options?: RequestAdjustOptions,
) {
    runtimeCallbacksByContext.get(ctx)?.requestAdjust?.(positionDiff, dataChanged, options);
}

export function runRuntimeUpdateScroll(ctx: StateContext, newScroll: number, forceUpdate?: boolean) {
    runtimeCallbacksByContext.get(ctx)?.updateScroll?.(newScroll, forceUpdate);
}
