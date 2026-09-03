import type { StateContext } from "@/state/state";
import type { LayoutRectangle } from "@/types.base";

export const IS_EXACT_INITIAL_LAYOUT_SUPPORTED = false;

export function useExactInitialLayoutFirstCommit(_getOptions: () => unknown) {
    return false;
}

export function attachExactInitialLayout(_ctx: StateContext) {}

export function isExactInitialLayoutActive(_ctx: StateContext) {
    return false;
}

export function seedExactInitialLayoutState(_ctx: StateContext) {}

export function getExactInitialContentOffset(_ctx: StateContext) {
    return undefined;
}

export function getExactInitialAverageItemSize(_ctx: StateContext) {
    return 0;
}

export function recordExactInitialLayoutNativeOffset(_ctx: StateContext, _offset: number) {}

export function invalidateExactInitialLayout(_ctx: StateContext) {}

export function verifyExactInitialLayoutOnMeasure(_ctx: StateContext, _layout: LayoutRectangle) {}

export function shouldFinishExactInitialScrollWithoutScroll(
    _ctx: StateContext,
    _resolvedOffset: number,
    _options: {
        areMountedBufferedIndicesMeasured: boolean;
        areVisibleIndicesMeasured: boolean;
    },
) {
    return false;
}
