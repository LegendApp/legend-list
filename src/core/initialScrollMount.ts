import { startBootstrapInitialScrollOnMount } from "@/core/bootstrapInitialScroll";
import { finishInitialScroll, getInitialContentOffsetForMount, setInitialScrollTarget } from "@/core/initialScroll";
import type { StateContext } from "@/state/state";
import { setInitialRenderState } from "@/utils/setInitialRenderState";

export function initializeInitialScrollOnMount(
    ctx: StateContext,
    options: {
        dataLength: number;
        initialContentOffset: number | undefined;
        initialScrollAtEnd: boolean;
        useBootstrapInitialScroll: boolean;
    },
) {
    const { dataLength, initialContentOffset, initialScrollAtEnd, useBootstrapInitialScroll } = options;
    const state = ctx.state;
    const initialScroll = state.initialScroll;
    const resolvedInitialContentOffset = initialContentOffset ?? 0;

    if (initialScroll && initialScroll.contentOffset === undefined && !state.initialScrollUsesOffset) {
        setInitialScrollTarget(state, {
            ...initialScroll,
            contentOffset: resolvedInitialContentOffset,
        });
    }

    if (useBootstrapInitialScroll && initialScroll && !state.initialScrollUsesOffset) {
        startBootstrapInitialScrollOnMount(ctx, {
            initialScrollAtEnd,
            target: state.initialScroll!,
        });
        return;
    }

    const hasPendingDataDependentInitialScroll =
        !!initialScroll && dataLength === 0 && !(resolvedInitialContentOffset === 0 && !initialScrollAtEnd);
    if (!resolvedInitialContentOffset && !hasPendingDataDependentInitialScroll) {
        if (initialScroll && !initialScrollAtEnd) {
            finishInitialScroll(ctx, {
                resolvedOffset: resolvedInitialContentOffset,
            });
        } else {
            setInitialRenderState(ctx, { didInitialScroll: true });
        }
    }
}

export { getInitialContentOffsetForMount };
