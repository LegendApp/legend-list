import { peek$, type StateContext, set$ } from "@/state/state";

export class ScrollAdjustHandler {
    private appliedAdjust = 0;
    private context: StateContext;
    private mounted = false;

    constructor(ctx: StateContext) {
        this.context = ctx;
    }
    requestAdjust(add: number) {
        const oldAdjustTop = this.appliedAdjust;

        this.appliedAdjust = add + oldAdjustTop;
        console.log("ScrollAdjustHandler requestAdjust", this.appliedAdjust, add, oldAdjustTop);

        const set = () => set$(this.context, "scrollAdjust", this.appliedAdjust);
        if (this.mounted) {
            set();
        } else {
            requestAnimationFrame(set);
        }
    }
    setMounted() {
        this.mounted = true;
    }
    getAdjust() {
        return this.appliedAdjust;
    }
}
