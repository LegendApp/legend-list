import { releaseDeferredPublicOnScroll } from "@/core/deferredPublicOnScroll";
import { initialScrollWatchdog, setInitialScrollSession } from "@/core/initialScrollSession";
import { Platform } from "@/platform/Platform";
import type { StateContext } from "@/state/state";
import { checkThresholds } from "@/utils/checkThresholds";
import { setInitialRenderState } from "@/utils/setInitialRenderState";

function syncInitialScrollOffset(state: StateContext["state"], offset: number) {
    state.scroll = offset;
    state.scrollPending = offset;
    state.scrollPrev = offset;
}

export function finishInitialScroll(
    ctx: StateContext,
    options?: {
        recalculateItems?: boolean;
        resolvedOffset?: number;
        preserveTarget?: boolean;
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
        if (!options?.preserveTarget) {
            state.initialScroll = undefined;
        }
        setInitialScrollSession(state);

        if (options?.recalculateItems && state.props?.data) {
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
        }

        if (options?.recalculateItems) {
            checkThresholds(ctx);
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
