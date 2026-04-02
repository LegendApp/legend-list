import {
    handleBootstrapInitialScrollDataChange,
    handleBootstrapInitialScrollFooterLayout,
    shouldUseBootstrapInitialScroll,
    startBootstrapInitialScrollOnMount,
} from "@/core/bootstrapInitialScroll";
import {
    advanceInitialScroll,
    finishInitialScroll,
    getInitialContentOffsetForMount,
    setInitialScrollTarget,
} from "@/core/initialScroll";
import type { LayoutRectangle } from "@/platform/platform-types";
import type { StateContext } from "@/state/state";
import { setInitialRenderState } from "@/utils/setInitialRenderState";

export { getInitialContentOffsetForMount, shouldUseBootstrapInitialScroll };

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

export function handleInitialScrollDataChange(
    ctx: StateContext,
    options: {
        dataLength: number;
        didDataChange: boolean;
        initialScrollAtEnd: boolean;
        previousDataLength: number;
        stylePaddingBottom: number;
        useBootstrapInitialScroll: boolean;
        waitForInitialLayout?: boolean;
    },
) {
    const {
        dataLength,
        didDataChange,
        initialScrollAtEnd,
        previousDataLength,
        stylePaddingBottom,
        useBootstrapInitialScroll,
        waitForInitialLayout,
    } = options;
    const state = ctx.state;

    state.initialScrollPreviousDataLength = dataLength;

    if (useBootstrapInitialScroll) {
        handleBootstrapInitialScrollDataChange(ctx, {
            dataLength,
            didDataChange,
            initialScrollAtEnd,
            previousDataLength,
            stylePaddingBottom,
        });
        return;
    }

    if (
        previousDataLength !== 0 ||
        dataLength === 0 ||
        !state.initialScroll ||
        !state.queuedInitialLayout ||
        state.didFinishInitialScroll
    ) {
        return;
    }

    advanceInitialScroll(ctx, {
        waitForInitialLayout,
    });
}

export function handleInitialScrollFooterLayout(
    ctx: StateContext,
    options: {
        dataLength: number;
        horizontal: boolean;
        initialScrollAtEnd: boolean;
        layout: LayoutRectangle;
        stylePaddingBottom: number;
        useBootstrapInitialScroll: boolean;
    },
) {
    const { dataLength, horizontal, initialScrollAtEnd, layout, stylePaddingBottom, useBootstrapInitialScroll } =
        options;
    if (!useBootstrapInitialScroll) {
        return;
    }

    handleBootstrapInitialScrollFooterLayout(ctx, {
        dataLength,
        footerSize: layout[horizontal ? "width" : "height"],
        initialScrollAtEnd,
        stylePaddingBottom,
    });
}
