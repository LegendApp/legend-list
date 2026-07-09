import { releaseDeferredPublicOnScroll } from "@/core/deferredPublicOnScroll";
import { initialScrollWatchdog, setInitialScrollSession } from "@/core/initialScrollSession";
import { recalculateSettledScroll } from "@/core/recalculateSettledScroll";
import { Platform } from "@/platform/Platform";
import type { StateContext } from "@/state/state";
import { setInitialRenderState } from "@/utils/setInitialRenderState";

const PRESERVED_INITIAL_SCROLL_FALLBACK_CLEAR_DELAY_MS = 2000;

function syncInitialScrollOffset(state: StateContext["state"], offset: number) {
    state.scroll = offset;
    state.scrollPending = offset;
    state.scrollPrev = offset;
}

function clearPreservedInitialScrollTargetTimeout(state: StateContext["state"]) {
    if (state.timeoutPreservedInitialScrollClear !== undefined) {
        clearTimeout(state.timeoutPreservedInitialScrollClear);
        state.timeoutPreservedInitialScrollClear = undefined;
    }
}

export function clearPreservedInitialScrollTarget(state: StateContext["state"]) {
    clearPreservedInitialScrollTargetTimeout(state);
    state.clearPreservedInitialScrollOnNextFinish = undefined;
    state.initialScroll = undefined;
    setInitialScrollSession(state);
}

export function finishInitialScroll(
    ctx: StateContext,
    options?: {
        recalculateItems?: boolean;
        resolvedOffset?: number;
        preserveTarget?: boolean;
        schedulePreservedTargetClear?: boolean;
        syncObservedOffset?: boolean;
        waitForCompletionFrame?: boolean;
        onFinished?: () => void;
    },
) {
    const state = ctx.state;

    if (options?.resolvedOffset !== undefined) {
        syncInitialScrollOffset(state, options.resolvedOffset);
    } else if (options?.syncObservedOffset && state.initialScrollSession?.kind === "offset") {
        const observedOffset = state.refScroller.current?.getCurrentScrollOffset?.();
        if (typeof observedOffset === "number" && Number.isFinite(observedOffset)) {
            syncInitialScrollOffset(state, observedOffset);
        }
    }

    const complete = () => {
        const shouldReleaseDeferredPublicOnScroll =
            Platform.OS === "web" && state.initialScrollSession?.kind === "bootstrap";
        const finalScrollOffset = options?.resolvedOffset ?? state.scrollPending ?? state.scroll ?? 0;
        initialScrollWatchdog.clear(state);
        if (options?.preserveTarget && state.initialScroll) {
            state.clearPreservedInitialScrollOnNextFinish = undefined;
            setInitialScrollSession(state);
            clearPreservedInitialScrollTargetTimeout(state);
            if (options?.schedulePreservedTargetClear) {
                // This is only a backstop. The main preservation lifecycle is
                // event-driven via late layout/data/user-scroll invalidation.
                state.timeoutPreservedInitialScrollClear = setTimeout(() => {
                    state.timeoutPreservedInitialScrollClear = undefined;
                    if (!state.didFinishInitialScroll || state.scrollingTo?.isInitialScroll || !state.initialScroll) {
                        return;
                    }

                    clearPreservedInitialScrollTarget(state);
                }, PRESERVED_INITIAL_SCROLL_FALLBACK_CLEAR_DELAY_MS);
            }
        } else {
            clearPreservedInitialScrollTarget(state);
        }

        if (options?.recalculateItems) {
            recalculateSettledScroll(ctx);
        }

        setInitialRenderState(ctx, { didInitialScroll: true });

        if (shouldReleaseDeferredPublicOnScroll) {
            releaseDeferredPublicOnScroll(ctx, finalScrollOffset);
        }

        options?.onFinished?.();
    };

    if (options?.waitForCompletionFrame) {
        requestAnimationFrame(complete);
        return;
    }

    complete();
}
