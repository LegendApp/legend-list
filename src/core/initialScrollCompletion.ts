import {
    hasBootstrapInitialScrollSession,
    shouldPreserveInitialScrollTargetOnFinish,
} from "@/core/bootstrapInitialScroll";
import { clampScrollOffset } from "@/core/clampScrollOffset";
import { getContentSize } from "@/state/getContentSize";
import type { StateContext } from "@/state/state";

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

    state.didDispatchNativeScroll = undefined;
    state.didRetrySilentInitialScroll = undefined;
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
    const shouldWatchInitialNativeScroll =
        !state.didFinishInitialScroll &&
        (isInitialScroll || !!state.initialNativeScrollWatchdog) &&
        targetOffset > INITIAL_SCROLL_MIN_TARGET_OFFSET;
    const shouldClearInitialNativeScrollWatchdog =
        !state.didFinishInitialScroll &&
        !!state.initialNativeScrollWatchdog &&
        requestedOffset <= INITIAL_SCROLL_MIN_TARGET_OFFSET;

    if (shouldWatchInitialNativeScroll) {
        state.hasScrolled = false;
        state.initialNativeScrollWatchdog = {
            startScroll: state.initialNativeScrollWatchdog?.startScroll ?? state.scroll,
            targetOffset,
        };
        return;
    }

    if (shouldClearInitialNativeScrollWatchdog) {
        state.initialNativeScrollWatchdog = undefined;
    }
}

export function markInitialScrollNativeDispatch(state: StateContext["state"]) {
    state.didDispatchNativeScroll = true;
}

function didObserveInitialScrollProgress(
    newScroll: number,
    watchdog: NonNullable<StateContext["state"]["initialNativeScrollWatchdog"]>,
) {
    const previousDistance = Math.abs(watchdog.startScroll - watchdog.targetOffset);
    const nextDistance = Math.abs(newScroll - watchdog.targetOffset);
    return (
        nextDistance <= INITIAL_SCROLL_MIN_TARGET_OFFSET ||
        nextDistance + INITIAL_SCROLL_MIN_TARGET_OFFSET < previousDistance
    );
}

export function trackInitialScrollNativeProgress(state: StateContext["state"], newScroll: number) {
    const initialNativeScrollWatchdog = state.initialNativeScrollWatchdog;
    const didInitialScrollProgress =
        !!initialNativeScrollWatchdog && didObserveInitialScrollProgress(newScroll, initialNativeScrollWatchdog);

    if (didInitialScrollProgress) {
        state.initialNativeScrollWatchdog = undefined;
        return true;
    }

    if (initialNativeScrollWatchdog) {
        state.hasScrolled = false;
        state.initialNativeScrollWatchdog = initialNativeScrollWatchdog;
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
    return !!scrollingTo?.isInitialScroll && !!state.didDispatchNativeScroll && !state.hasScrolled;
}

export function isNativeInitialNonZeroTarget(state: StateContext["state"]) {
    return (
        !state.didFinishInitialScroll &&
        !!state.initialNativeScrollWatchdog &&
        state.initialNativeScrollWatchdog.targetOffset > INITIAL_SCROLL_MIN_TARGET_OFFSET
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
    if (targetOffset > INITIAL_SCROLL_MIN_TARGET_OFFSET && state.didDispatchNativeScroll && !state.hasScrolled) {
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
    return {
        preserveTarget:
            (state.initialScrollUsesOffset && state.props.data.length === 0) ||
            shouldPreserveInitialScrollTargetOnFinish(state, scrollingTo),
        recalculateItems: true,
        syncObservedOffset: state.initialScrollUsesOffset,
        waitForCompletionFrame: !!scrollingTo.waitForInitialScrollCompletionFrame,
    };
}
