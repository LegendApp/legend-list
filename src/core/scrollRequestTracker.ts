import { settlePendingImperativeScroll, syncScrollActive } from "@/core/cancelImperativeScroll";
import { cancelScroll, stopScrollAnimation } from "@/core/cancelScroll";
import { interruptMaintainScrollAtEnd, rearmEndFollowIfSettled } from "@/core/finishMaintainScrollAtEnd";
import { type StateContext, set$ } from "@/state/state";
import type { ScrollResolve } from "@/types.internal";

export type ScrollRequestRun = () => boolean | "unreachable";

export interface ScrollRequestTracker {
    /** Returns whether a superseded animation was still owed a native stop. */
    cancel(): boolean;
    isCurrent(token: number): boolean;
    isWaitingToRun(): boolean;
    runNow(token: number, resolve: ScrollResolve, run: ScrollRequestRun): void;
    runNowIfIdle(run: ScrollRequestRun): Promise<void>;
    start(resolve: ScrollResolve): number;
}

export function getScrollRequestTracker(ctx: StateContext): ScrollRequestTracker {
    if (!ctx.scrollRequestTracker) {
        let currentToken = 0;
        let waitingToken: number | undefined;
        let stopToken: number | undefined;

        const start = (resolve: ScrollResolve, isInternal = false) => {
            const state = ctx.state;
            const supersedesAnimation = !isInternal && !!state.scrollingTo?.animated;
            // A newer explicit target supersedes automatic end-follow intent.
            if (!isInternal) {
                // Release the superseded motion now, but stop it and apply its deferred adjustments
                // only if the replacement dispatches nothing: on Android either one cancels the
                // next animation, so a dispatching replacement commits them when it finishes.
                if (supersedesAnimation) cancelScroll(ctx, false, false);
                state.scheduledWork.cancel("appScrollRearm");
                state.pendingEndMeasurements = undefined;
                state.visibleContentAnchor = undefined;
                state.userScrollAnchorReset = undefined;
                interruptMaintainScrollAtEnd(ctx);
            }
            state.scheduledWork.cancel("imperativeScrollReady");
            const token = ++currentToken;
            // A replacement still waiting to run carries its pending stop to the next request.
            stopToken = supersedesAnimation || stopToken !== undefined ? token : undefined;

            settlePendingImperativeScroll(state);
            state.pendingScrollResolve = resolve;
            waitingToken = token;
            set$(ctx, "isScrollActive", true);

            return token;
        };

        const runNow = (token: number, resolve: ScrollResolve, run: ScrollRequestRun) => {
            const state = ctx.state;
            if (token !== currentToken) {
                return;
            }

            waitingToken = undefined;
            const didStartScroll = run();
            if (stopToken === token) {
                stopToken = undefined;
                if (didStartScroll !== true) {
                    stopScrollAnimation(ctx);
                    state.scrollAdjustHandler.commitPendingAdjust();
                }
            }
            if (didStartScroll === "unreachable" || (!didStartScroll && state.scrollingTo)) {
                // A visible-region request can finish without replacing the previous instant target.
                cancelScroll(ctx);
                return;
            }
            if (!didStartScroll || !state.scrollingTo) {
                if (state.pendingScrollResolve === resolve) {
                    state.pendingScrollResolve = undefined;
                }
                syncScrollActive(ctx);
                rearmEndFollowIfSettled(ctx);
                resolve();
            }
        };

        ctx.scrollRequestTracker = {
            cancel: () => {
                const owedStop = stopToken !== undefined;
                currentToken++;
                waitingToken = undefined;
                stopToken = undefined;
                return owedStop;
            },
            isCurrent: (token) => token === currentToken,
            isWaitingToRun: () => waitingToken === currentToken && !!ctx.state.pendingScrollResolve,
            runNow,
            runNowIfIdle: (run) => {
                const state = ctx.state;
                // Automatic end maintenance must not supersede an explicit or otherwise active scroll target.
                if (state.pendingScrollResolve || state.scrollingTo) {
                    return Promise.resolve();
                }
                return new Promise<void>((resolve) => {
                    const token = start(resolve, true);
                    runNow(token, resolve, run);
                });
            },
            start,
        };
    }

    return ctx.scrollRequestTracker;
}
