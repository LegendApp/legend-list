import { calculateItemsInView } from "@/core/calculateItemsInView";
import { Platform } from "@/platform/Platform";
import { listen$, peek$, type StateContext, set$ } from "@/state/state";

type AdjustKey = "scrollAdjust" | "scrollAdjustPending";

export class ScrollAdjustHandler {
    private appliedAdjust = 0;
    private pendingAdjust = 0;
    private context: StateContext;
    private mounted = false;

    constructor(ctx: StateContext) {
        this.context = ctx;
        listen$(this.context, "scrollingTo", (value) => {
            if (value === undefined) {
                this.commitPendingAdjust();
            }
        });
    }
    requestAdjust(add: number) {
        const scrollingTo = peek$(this.context, "scrollingTo");

        if (Platform.OS === "web" && scrollingTo?.animated && !scrollingTo.isInitialScroll) {
            this.pendingAdjust += add;
            set$(this.context, "scrollAdjustPending", this.pendingAdjust);
        } else {
            this.appliedAdjust += add;
            const setter = () => set$(this.context, "scrollAdjust", this.appliedAdjust);
            if (this.mounted) {
                setter();
            } else {
                requestAnimationFrame(setter);
            }
        }
    }
    setMounted() {
        this.mounted = true;
    }
    getAdjust() {
        return this.appliedAdjust;
    }
    private commitPendingAdjust() {
        const pending = this.pendingAdjust;
        this.pendingAdjust = 0;

        this.appliedAdjust += pending;
        set$(this.context, "scrollAdjustPending", 0);
        set$(this.context, "scrollAdjust", this.appliedAdjust);
        calculateItemsInView(this.context, this.context.internalState!);
    }
}
