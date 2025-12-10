import { calculateItemsInView } from "@/core/calculateItemsInView";
import { checkFinishedScroll } from "@/core/checkFinishedScroll";
import { Platform } from "@/platform/Platform";
import { type StateContext, set$ } from "@/state/state";

export class ScrollAdjustHandler {
    private appliedAdjust = 0;
    private pendingAdjust = 0;
    private ctx: StateContext;

    constructor(ctx: StateContext) {
        this.ctx = ctx;
    }
    requestAdjust(add: number) {
        const scrollingTo = this.ctx.state.scrollingTo;

        if (Platform.OS === "web" && scrollingTo?.animated && !scrollingTo.isInitialScroll) {
            this.pendingAdjust += add;
            set$(this.ctx, "scrollAdjustPending", this.pendingAdjust);
        } else {
            this.appliedAdjust += add;
            set$(this.ctx, "scrollAdjust", this.appliedAdjust);
        }

        if (this.ctx.state.scrollingTo) {
            checkFinishedScroll(this.ctx);
        }
    }
    getAdjust() {
        return this.appliedAdjust;
    }
    commitPendingAdjust() {
        if (Platform.OS === "web") {
            // On web, scrollBy during a scrollTo breaks the scrollTo,
            // so we need to set scrollAdjustPending while doing the scrollTo
            // and then do the normal scrollBy when it's finished.
            const state = this.ctx.state;
            const pending = this.pendingAdjust;
            if (pending !== 0) {
                this.pendingAdjust = 0;

                this.appliedAdjust += pending;
                state.scroll += pending;
                state.scrollForNextCalculateItemsInView = undefined;

                set$(this.ctx, "scrollAdjustPending", 0);
                set$(this.ctx, "scrollAdjust", this.appliedAdjust);
                calculateItemsInView(this.ctx);
            }
        }
    }
}
