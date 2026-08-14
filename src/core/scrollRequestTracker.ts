import { settlePendingImperativeScroll } from "@/core/cancelImperativeScroll";
import type { StateContext } from "@/state/state";

export interface ScrollRequestTracker {
    isCurrent(token: number): boolean;
    runNow(token: number, resolve: () => void, run: () => boolean): void;
    runNowIfIdle(run: () => boolean): Promise<void>;
    start(resolve: () => void): number;
}

export function getScrollRequestTracker(ctx: StateContext): ScrollRequestTracker {
    if (!ctx.scrollRequestTracker) {
        let currentToken = 0;

        const start = (resolve: () => void) => {
            const state = ctx.state;
            state.scheduledWork.cancel("imperativeScrollReady");
            const token = ++currentToken;

            settlePendingImperativeScroll(state);
            state.pendingScrollResolve = resolve;

            return token;
        };

        const runNow = (token: number, resolve: () => void, run: () => boolean) => {
            const state = ctx.state;
            if (token !== currentToken) {
                return;
            }

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
            runNow,
            runNowIfIdle: (run) => {
                const state = ctx.state;
                // Automatic end maintenance must not supersede an explicit or otherwise active scroll target.
                if (state.pendingScrollResolve || state.scrollingTo) {
                    return Promise.resolve();
                }
                return new Promise<void>((resolve) => {
                    const token = start(resolve);
                    runNow(token, resolve, run);
                });
            },
            start,
        };
    }

    return ctx.scrollRequestTracker;
}
