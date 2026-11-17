import type { Ref } from "react";

import type { NativeScrollEvent, NativeSyntheticEvent } from "@/platform/platform-types";
import type { LooseScrollView } from "@/platform/scrollview-types";
import type { StateContext } from "@/state/state";

export function useStickyScrollHandler(
    _stickyHeaderIndices: number[] | undefined,
    _horizontal: boolean | undefined | null,
    _ctx: StateContext,
    onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void,
    refScrollView: Ref<LooseScrollView | null>,
) {
    return { onScroll, refScrollView };
}
