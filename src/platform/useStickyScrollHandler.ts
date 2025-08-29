import type { NativeScrollEvent, NativeSyntheticEvent } from "@/platform/platform-types";
import type { StateContext } from "@/state/state";

export function useStickyScrollHandler(
    stickyIndices: number[] | undefined,
    horizontal: boolean,
    ctx: StateContext,
    onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void,
) {
    return onScroll;
}
