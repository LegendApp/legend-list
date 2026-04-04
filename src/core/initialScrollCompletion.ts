import {
    hasBootstrapInitialScrollSession,
    shouldPreserveInitialScrollTargetOnFinish,
} from "@/core/bootstrapInitialScroll";
import { clampScrollOffset } from "@/core/clampScrollOffset";
import {
    getInitialScrollSessionDidDispatchNativeScroll,
    getInitialScrollSessionKind,
    getInitialScrollSessionWatchdog,
    markInitialScrollSessionNativeDispatch,
    resetInitialScrollSessionCompletionState,
    setInitialScrollSessionWatchdog,
} from "@/core/initialScrollSession";
import { getContentSize } from "@/state/getContentSize";
import type { StateContext } from "@/state/state";
import type { InitialScrollSessionCompletion } from "@/types.base";

export const INITIAL_SCROLL_MIN_TARGET_OFFSET = 1;
export const INITIAL_SCROLL_MAX_FALLBACK_CHECKS = 20;
export const INITIAL_SCROLL_ZERO_TARGET_EPSILON = 1;
export const SILENT_INITIAL_SCROLL_RETRY_DELAY_MS = 16;
export const SILENT_INITIAL_SCROLL_TARGET_EPSILON = 1;

export type ActiveScrollTarget = NonNullable<StateContext["state"]["scrollingTo"]>;

export function resetInitialScrollCompletionDispatchState(
    state: StateContext["state"],
    isInitialScroll: boolean | undefined,
) {
    if (!isInitialScroll) {
        return;
    }

    resetInitialScrollSessionCompletionState(state);
}

export function syncInitialScrollNativeWatchdog(
    state: StateContext["state"],
    options: {
        isInitialScroll: boolean | undefined;
        requestedOffset: number;
        targetOffset: number;
    },
) {
    const { isInitialScroll, requestedOffset, targetOffset } = options;
    const existingWatchdog = getInitialScrollSessionWatchdog(state);
    const shouldWatchInitialNativeScroll =
        !state.didFinishInitialScroll &&
        (isInitialScroll || !!existingWatchdog) &&
        targetOffset > INITIAL_SCROLL_MIN_TARGET_OFFSET;
    const shouldClearInitialNativeScrollWatchdog =
        !state.didFinishInitialScroll && !!existingWatchdog && requestedOffset <= INITIAL_SCROLL_MIN_TARGET_OFFSET;

    if (shouldWatchInitialNativeScroll) {
        state.hasScrolled = false;
        setInitialScrollSessionWatchdog(state, {
            startScroll: existingWatchdog?.startScroll ?? state.scroll,
            targetOffset,
        });
        return;
    }

    if (shouldClearInitialNativeScrollWatchdog) {
        setInitialScrollSessionWatchdog(state, undefined);
    }
}

export function markInitialScrollNativeDispatch(state: StateContext["state"], isInitialScroll: boolean | undefined) {
    if (!isInitialScroll) {
        return;
    }

    markInitialScrollSessionNativeDispatch(state);
}

function didObserveInitialScrollProgress(
    newScroll: number,
    watchdog: NonNullable<InitialScrollSessionCompletion["watchdog"]>,
) {
    const previousDistance = Math.abs(watchdog.startScroll - watchdog.targetOffset);
    const nextDistance = Math.abs(newScroll - watchdog.targetOffset);
    return (
        nextDistance <= INITIAL_SCROLL_MIN_TARGET_OFFSET ||
        nextDistance + INITIAL_SCROLL_MIN_TARGET_OFFSET < previousDistance
    );
}

export function trackInitialScrollNativeProgress(state: StateContext["state"], newScroll: number) {
    const initialNativeScrollWatchdog = getInitialScrollSessionWatchdog(state);
    const didInitialScrollProgress =
        !!initialNativeScrollWatchdog && didObserveInitialScrollProgress(newScroll, initialNativeScrollWatchdog);

    if (didInitialScrollProgress) {
        setInitialScrollSessionWatchdog(state, undefined);
        return true;
    }

    if (initialNativeScrollWatchdog) {
        state.hasScrolled = false;
        setInitialScrollSessionWatchdog(state, initialNativeScrollWatchdog);
    }

    return false;
}

export function getResolvedScrollCompletionState(ctx: StateContext, scrollingTo: ActiveScrollTarget) {
    const { state } = ctx;
    const scroll = state.scrollPending;
    const adjust = state.scrollAdjustHandler.getAdjust();
    const clampedTargetOffset =
        scrollingTo.targetOffset ??
        clampScrollOffset(ctx, scrollingTo.offset - (scrollingTo.viewOffset || 0), scrollingTo);
    const maxOffset = clampScrollOffset(ctx, scroll, scrollingTo);

    const diff1 = Math.abs(scroll - clampedTargetOffset);
    const diff2 = Math.abs(diff1 - adjust);
    return {
        clampedTargetOffset,
        isAtResolvedTarget: Math.abs(scroll - maxOffset) < 1 && (diff1 < 1 || (!scrollingTo.animated && diff2 < 1)),
    };
}

export function hasScrollCompletionOwnership(
    state: StateContext["state"],
    options: { clampedTargetOffset: number; scrollingTo: ActiveScrollTarget },
) {
    const { clampedTargetOffset, scrollingTo } = options;
    return !scrollingTo.isInitialScroll || state.hasScrolled || clampedTargetOffset <= INITIAL_SCROLL_MIN_TARGET_OFFSET;
}

export function shouldQueueAlignedInitialScrollCompletionCheck(ctx: StateContext) {
    const scrollingTo = ctx.state.scrollingTo;
    if (!scrollingTo?.isInitialScroll || scrollingTo.animated) {
        return false;
    }

    return getResolvedScrollCompletionState(ctx, scrollingTo).isAtResolvedTarget;
}

export function isSilentInitialDispatch(state: StateContext["state"], scrollingTo: ActiveScrollTarget | undefined) {
    return (
        !!scrollingTo?.isInitialScroll && getInitialScrollSessionDidDispatchNativeScroll(state) && !state.hasScrolled
    );
}

export function isNativeInitialNonZeroTarget(state: StateContext["state"]) {
    const targetOffset = getInitialScrollSessionWatchdog(state)?.targetOffset;
    return (
        !state.didFinishInitialScroll && targetOffset !== undefined && targetOffset > INITIAL_SCROLL_MIN_TARGET_OFFSET
    );
}

export function shouldFinishInitialScrollWithoutNativeProgress(
    state: StateContext["state"],
    scrollingTo: ActiveScrollTarget,
) {
    if (!scrollingTo.isInitialScroll || scrollingTo.animated || !state.didContainersLayout) {
        return false;
    }

    if (hasBootstrapInitialScrollSession(state)) {
        return false;
    }

    const targetOffset = scrollingTo.targetOffset ?? scrollingTo.offset;
    if (
        targetOffset > INITIAL_SCROLL_MIN_TARGET_OFFSET &&
        getInitialScrollSessionDidDispatchNativeScroll(state) &&
        !state.hasScrolled
    ) {
        return false;
    }

    if (
        targetOffset <= INITIAL_SCROLL_MIN_TARGET_OFFSET ||
        Math.abs(state.scroll - targetOffset) > 1 ||
        Math.abs(state.scrollPending - targetOffset) > 1
    ) {
        return false;
    }

    return !!scrollingTo.waitForInitialScrollCompletionFrame || isNativeInitialNonZeroTarget(state);
}

export function shouldFinishInitialZeroTargetScroll(ctx: StateContext) {
    const { state } = ctx;
    return (
        !!state.scrollingTo?.isInitialScroll &&
        state.props.data.length > 0 &&
        getContentSize(ctx) <= state.scrollLength &&
        state.scrollPending <= INITIAL_SCROLL_ZERO_TARGET_EPSILON
    );
}

export function getInitialScrollFinishOptions(state: StateContext["state"], scrollingTo: ActiveScrollTarget) {
    const isOffsetSession = getInitialScrollSessionKind(state) === "offset";
    return {
        preserveTarget:
            (isOffsetSession && state.props.data.length === 0) ||
            shouldPreserveInitialScrollTargetOnFinish(state, scrollingTo),
        recalculateItems: true,
        syncObservedOffset: isOffsetSession,
        waitForCompletionFrame: !!scrollingTo.waitForInitialScrollCompletionFrame,
    };
}
