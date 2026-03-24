import type { StateContext } from "@/state/state";

type RuntimeCallbacks = {
    requestAdjust?: (positionDiff: number, dataChanged?: boolean) => void;
    updateScroll?: (newScroll: number, forceUpdate?: boolean) => void;
};

const runtimeCallbacksByContext = new WeakMap<StateContext, RuntimeCallbacks>();

export function setRuntimeCallbacks(ctx: StateContext, callbacks: RuntimeCallbacks) {
    runtimeCallbacksByContext.set(ctx, callbacks);
}

export function runRuntimeRequestAdjust(ctx: StateContext, positionDiff: number, dataChanged?: boolean) {
    runtimeCallbacksByContext.get(ctx)?.requestAdjust?.(positionDiff, dataChanged);
}

export function runRuntimeUpdateScroll(ctx: StateContext, newScroll: number, forceUpdate?: boolean) {
    runtimeCallbacksByContext.get(ctx)?.updateScroll?.(newScroll, forceUpdate);
}
