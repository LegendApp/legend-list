import type { NativeScrollEvent, NativeSyntheticEvent } from "@/platform/platform-types";
import type { StateContext } from "@/state/state";

function withResolvedContentOffset(
    state: StateContext["state"],
    event: NativeSyntheticEvent<NativeScrollEvent>,
    resolvedOffset: number,
): NativeSyntheticEvent<NativeScrollEvent> {
    return {
        ...event,
        nativeEvent: {
            ...event.nativeEvent,
            contentOffset: state.props.horizontal ? { x: resolvedOffset, y: 0 } : { x: 0, y: resolvedOffset },
        },
    };
}

export function releaseDeferredPublicOnScroll(ctx: StateContext, resolvedOffset?: number) {
    const state = ctx.state;
    const deferredEvent = state.deferredPublicOnScrollEvent;
    state.deferredPublicOnScrollEvent = undefined;

    if (deferredEvent) {
        state.props.onScroll?.(
            withResolvedContentOffset(
                state,
                deferredEvent,
                resolvedOffset ?? state.scrollPending ?? state.scroll ?? 0,
            ) as any,
        );
    }
}
