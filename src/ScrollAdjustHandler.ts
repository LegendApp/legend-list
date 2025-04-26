import { type StateContext, peek$, set$ } from "./state";

export class ScrollAdjustHandler {
    private appliedAdjust = 0;

    private busy = false;
    private context: StateContext;
    private isPaused = false;
    private isDisabled = false;

    constructor(private ctx: any) {
        this.context = ctx;
    }

    private doAjdust() {
        set$(this.context, "scrollAdjust", this.appliedAdjust);
        this.busy = false;
    }

    requestAdjust(adjust: number, onAdjusted: (diff: number) => void) {
        if (this.isDisabled) {
            return;
        }
        const oldAdjustTop = peek$(this.context, "scrollAdjust");
        if (oldAdjustTop === adjust) {
            return;
        }

        this.appliedAdjust = adjust;

        if (!this.busy && !this.isPaused) {
            this.busy = true;
            this.doAjdust();
            onAdjusted(oldAdjustTop - adjust);
        }
    }
    getAppliedAdjust() {
        return this.appliedAdjust;
    }
    pauseAdjust() {
        this.isPaused = true;
    }
    setDisableAdjust(disable: boolean) {
        this.isDisabled = disable;
    }
    // return true if it was paused
    unPauseAdjust() {
        if (this.isPaused) {
            this.isPaused = false;
            this.doAjdust();
            return true;
        }
        return false;
    }
}
