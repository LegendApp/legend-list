import { peek$, type StateContext, set$ } from "@/state/state";

export class ScrollAdjustHandler {
    private appliedAdjust = 0;
    private context: StateContext;
    private mounted = false;

    constructor(ctx: StateContext) {
        this.context = ctx;
    }
    requestAdjust(add: number) {
        const oldAdjustTop = peek$(this.context, "scrollAdjust") || 0;

        this.appliedAdjust = add + oldAdjustTop;

        const set = () => set$(this.context, "scrollAdjust", this.appliedAdjust);
        if (this.mounted) {
            set();
        } else {
            requestAnimationFrame(set);
        }
    }
    getAdjust() {
        return this.appliedAdjust;
    }
    setMounted() {
        this.mounted = true;
    }
}
