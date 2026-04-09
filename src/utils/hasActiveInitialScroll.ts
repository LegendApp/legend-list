import type { InternalState } from "@/types.base";

export function hasActiveInitialScroll(state: InternalState | null | undefined) {
    return !!state?.initialScroll && !state.didFinishInitialScroll;
}
