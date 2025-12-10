import { calculateItemsInView } from "@/core/calculateItemsInView";
import { checkFinishedScroll } from "@/core/checkFinishedScroll";
import { Platform } from "@/platform/Platform";
import { listen$, peek$, type StateContext, set$ } from "@/state/state";

export class ScrollAdjustHandler {
    private appliedAdjust = 0;
    private pendingAdjust = 0;
    private context: StateContext;

    constructor(ctx: StateContext) {
        this.context = ctx;
        if (Platform.OS === "web") {
            // On web, scrollBy during a scrollTo breaks the scrollTo,
            // so we need to set scrollAdjustPending while doing the scrollTo
            // and then do the normal scrollBy when it's finished.
            const commitPendingAdjust = () => {
                const state = this.context.state;
                const pending = this.pendingAdjust;
                if (pending !== 0) {
                    this.pendingAdjust = 0;

                    this.appliedAdjust += pending;
                    state.scroll += pending;
                    state.scrollForNextCalculateItemsInView = undefined;

                    set$(this.context, "scrollAdjustPending", 0);
                    set$(this.context, "scrollAdjust", this.appliedAdjust);
                    calculateItemsInView(this.context);
                }
            };
            listen$(this.context, "scrollingTo", (value) => {
                if (value === undefined) {
                    commitPendingAdjust();
                }
            });
        }
    }
    requestAdjust(add: number) {
        const scrollingTo = peek$(this.context, "scrollingTo");

        if (Platform.OS === "web" && scrollingTo?.animated && !scrollingTo.isInitialScroll) {
            this.pendingAdjust += add;
            set$(this.context, "scrollAdjustPending", this.pendingAdjust);
        } else {
            this.appliedAdjust += add;
            set$(this.context, "scrollAdjust", this.appliedAdjust);
        }

        if (peek$(this.context, "scrollingTo")) {
            checkFinishedScroll(this.context);
        }
    }
    getAdjust() {
        return this.appliedAdjust;
    }
}
