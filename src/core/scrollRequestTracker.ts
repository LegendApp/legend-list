import { settlePendingImperativeScroll } from "@/core/cancelImperativeScroll";
import { interruptMaintainScrollAtEnd } from "@/core/doMaintainScrollAtEnd";
import { type StateContext, set$ } from "@/state/state";
import type { LegendListScrollResult } from "@/types.base";
import type { ScrollResolve } from "@/types.internal";

export interface ScrollRequestTracker {
    cancel(): void;
    isCurrent(token: number): boolean;
    isWaitingToRun(): boolean;
    runNow(token: number, resolve: ScrollResolve, run: () => boolean): void;
    runNowIfIdle(run: () => boolean): Promise<LegendListScrollResult>;
    start(resolve: ScrollResolve): number;
}

export function getScrollRequestTracker(ctx: StateContext): ScrollRequestTracker {
    if (!ctx.scrollRequestTracker) {
        let currentToken = 0;
        let waitingToken: number | undefined;

        const start = (resolve: ScrollResolve, isInternal = false) => {
            const state = ctx.state;
            // A newer explicit target supersedes automatic end-follow intent.
            if (!isInternal) {
                state.pendingEndMeasurements = undefined;
                state.visibleContentAnchor = undefined;
                state.scrollElementTarget = undefined;
                state.userScrollAnchorReset = undefined;
                interruptMaintainScrollAtEnd(ctx, "superseded");
            }
            state.scheduledWork.cancel("imperativeScrollReady");
            const token = ++currentToken;

            settlePendingImperativeScroll(state);
            state.pendingScrollResolve = resolve;
            waitingToken = token;
            set$(ctx, "isScrollActive", true);

            return token;
        };

        const runNow = (token: number, resolve: ScrollResolve, run: () => boolean) => {
            const state = ctx.state;
            if (token !== currentToken) {
                return;
            }

            waitingToken = undefined;
            const didStartScroll = run();
            if (!didStartScroll || !state.scrollingTo) {
                if (state.pendingScrollResolve === resolve) {
                    state.pendingScrollResolve = undefined;
                }
                set$(
                    ctx,
                    "isScrollActive",
                    !!state.isDragging ||
                        !!state.isMomentumScrolling ||
                        !!state.scrollingTo ||
                        !!state.pendingScrollResolve,
                );
                resolve();
            }
        };

        ctx.scrollRequestTracker = {
            cancel: () => {
                currentToken++;
                waitingToken = undefined;
            },
            isCurrent: (token) => token === currentToken,
            isWaitingToRun: () => waitingToken === currentToken && !!ctx.state.pendingScrollResolve,
            runNow,
            runNowIfIdle: (run) => {
                const state = ctx.state;
                // Automatic end maintenance must not supersede an explicit or otherwise active scroll target.
                if (state.pendingScrollResolve || state.scrollingTo) {
                    return Promise.resolve(undefined);
                }
                return new Promise<LegendListScrollResult>((resolve) => {
                    const token = start(resolve, true);
                    runNow(token, resolve, run);
                });
            },
            start,
        };
    }

    return ctx.scrollRequestTracker;
}
