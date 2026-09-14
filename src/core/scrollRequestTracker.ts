import { settlePendingImperativeScroll } from "@/core/cancelImperativeScroll";
import { finishMaintainScrollAtEnd } from "@/core/doMaintainScrollAtEnd";
import type { StateContext } from "@/state/state";

export interface ScrollRequestTracker {
    isCurrent(token: number): boolean;
    isWaitingToRun(): boolean;
    runNow(token: number, resolve: () => void, run: () => boolean): void;
    runNowIfIdle(run: () => boolean): Promise<void>;
    start(resolve: () => void): number;
}

export function getScrollRequestTracker(ctx: StateContext): ScrollRequestTracker {
    if (!ctx.scrollRequestTracker) {
        let currentToken = 0;
        let waitingToken: number | undefined;

        const start = (resolve: () => void, isInternal = false) => {
            const state = ctx.state;
            // A newer explicit target supersedes automatic end-follow intent.
            if (!isInternal && (state.maintainingScrollAtEnd || state.pendingMaintainScrollAtEnd)) {
                finishMaintainScrollAtEnd(ctx);
            }
            state.scheduledWork.cancel("imperativeScrollReady");
            const token = ++currentToken;

            settlePendingImperativeScroll(state);
            state.pendingScrollResolve = resolve;
            waitingToken = token;

            return token;
        };

        const runNow = (token: number, resolve: () => void, run: () => boolean) => {
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
                resolve();
            }
        };

        ctx.scrollRequestTracker = {
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
