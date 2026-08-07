import { scrollTo } from "@/core/scrollTo";
import type { InternalState, ScrollIndexWithOffset } from "@/types";

export function scheduleInitialScrollAfterLayout(
    state: InternalState,
    initialScroll: ScrollIndexWithOffset,
    initialContentOffset: number,
) {
    return requestAnimationFrame(() => {
        scrollTo(state, {
            ...initialScroll,
            animated: false,
            isInitialScroll: true,
            offset: initialContentOffset,
            viewPosition: initialScroll.index === state.props.data.length - 1 ? 1 : 0,
        });
    });
}
