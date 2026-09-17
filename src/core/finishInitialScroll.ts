import { cancelScrollCompletionChecks } from "@/core/cancelImperativeScroll";
import { releaseDeferredPublicOnScroll } from "@/core/deferredPublicOnScroll";
import { isEndOfContentTarget } from "@/core/endOfContentTarget";
import { getDataLength } from "@/core/IndexedData";
import { initialScrollCompletion, initialScrollWatchdog } from "@/core/initialScrollSession";
import { getObservedScrollOffset } from "@/core/observedScroll";
import { recalculateSettledScroll } from "@/core/recalculateSettledScroll";
import { Platform } from "@/platform/Platform";
import { type StateContext, set$ } from "@/state/state";
import { setInitialRenderState } from "@/utils/setInitialRenderState";

function syncInitialScrollOffset(state: StateContext["state"], offset: number) {
    state.scroll = offset;
    state.scrollPending = offset;
}

export function clearInitialScrollAnchor(state: StateContext["state"]) {
    state.scheduledWork.cancel("preservedInitialScroll");
    state.scheduledWork.cancel("initialScrollAlignment");
    state.initialScrollAnchor = undefined;
}

function preserveInitialScrollAnchor(
    state: StateContext["state"],
    target: NonNullable<StateContext["state"]["initialScroll"]>,
) {
    clearInitialScrollAnchor(state);
    // Keep geometry only: completion and measurement state belong to initialization.
    const { bootstrap: _, completion: __, previousDataLength: ___, ...anchor } = target;
    state.initialScrollAnchor = { ...anchor, contentOffset: state.scrollPending ?? state.scroll };
    state.scheduledWork.timeout(() => clearInitialScrollAnchor(state), 2000, "preservedInitialScroll");
}

export function clearPreservedInitialScrollTarget(state: StateContext["state"]) {
    state.scheduledWork.cancel("initialScrollCompletion");
    clearInitialScrollAnchor(state);
    state.initialScroll = undefined;
}

export function supersedeInitialScroll(ctx: StateContext) {
    const state = ctx.state;

    if (state.initialScroll || state.initialScrollAnchor || state.scrollingTo?.isInitialScroll) {
        state.scheduledWork.cancel("initialScrollFrame");
        state.scheduledWork.cancel("initialScrollLayout");
        if (state.scrollingTo?.isInitialScroll) {
            cancelScrollCompletionChecks(state);
            state.scrollingTo = undefined;
            state.scrollTargetPinnedRange = undefined;
        }

        initialScrollCompletion.resetFlags(state);
        if (state.initialScroll) state.initialScroll.bootstrap = undefined;
        finishInitialScroll(ctx);
    }
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
    const freshDataTransitionEpoch = state.freshDataTransitionEpoch;
    const target = state.initialScroll;
    state.scheduledWork.cancel("initialScrollCompletion");

    if (options?.resolvedOffset !== undefined) {
        syncInitialScrollOffset(state, options.resolvedOffset);
    } else if (options?.syncObservedOffset && state.initialScroll?.kind === "offset") {
        const observedOffset = getObservedScrollOffset(ctx);
        if (Number.isFinite(observedOffset)) {
            syncInitialScrollOffset(state, observedOffset);
        }
    }

    const complete = () => {
        if (state.isUnmounted) {
            return;
        }
        // A queued completion belongs to the dataset that scheduled it.
        if (freshDataTransitionEpoch !== state.freshDataTransitionEpoch) {
            options?.onFinished?.();
            return;
        }
        if (state.initialScroll !== target) return;
        const shouldReleaseDeferredPublicOnScroll =
            Platform.OS === "web" && !!state.initialScroll && state.initialScroll.kind !== "offset";
        if (
            isEndOfContentTarget(state.initialScroll, getDataLength(state)) &&
            state.props.maintainScrollAtEnd &&
            !state.endFollowInterrupted
        ) {
            set$(ctx, "isFollowingEnd", true);
        }
        const finalScrollOffset = options?.resolvedOffset ?? state.scrollPending ?? state.scroll ?? 0;
        initialScrollWatchdog.clear(state);
        if (options?.preserveTarget && state.initialScroll && getDataLength(state) === 0) {
            state.initialScroll.bootstrap = undefined;
        } else {
            const preserved = options?.preserveTarget ? state.initialScroll : undefined;
            clearPreservedInitialScrollTarget(state);
            if (preserved) preserveInitialScrollAnchor(state, preserved);
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
        state.scheduledWork.frame(complete, "initialScrollCompletion");
        return;
    }

    complete();
}
