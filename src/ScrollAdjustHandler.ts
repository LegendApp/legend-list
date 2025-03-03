import { type StateContext, peek$, set$ } from "./state";

export class ScrollAdjustHandler {
    private appliedAdjust = 0;
    private pendingAdjust = 0;
    //private busy = false;
    private context: StateContext;
    private firstAdjust = true;
    constructor(private ctx: any) {
        this.context = ctx;
    }

    requestAdjust(adjust: number, onAdjusted: (diff: number) => void) {
        const oldAdjustTop = peek$<number>(this.context, "scrollAdjust");
        if (oldAdjustTop === adjust) {
            return;
        }

        this.appliedAdjust = adjust;
        this.pendingAdjust = adjust;

        set$(this.context, "scrollAdjust", this.pendingAdjust);
        onAdjusted(oldAdjustTop - this.pendingAdjust);
    }
    getAppliedAdjust() {
        return this.appliedAdjust;
    }
}
