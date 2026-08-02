import { calculateItemsInView } from "@/core/calculateItemsInView";
import { calculateOffsetForIndex } from "@/core/calculateOffsetForIndex";
import { calculateOffsetWithOffsetPosition } from "@/core/calculateOffsetWithOffsetPosition";
import { checkFinishedScroll } from "@/core/checkFinishedScroll";
import { clampScrollOffset } from "@/core/clampScrollOffset";
import { Platform, PlatformAdjustBreaksScroll } from "@/platform/Platform";
import { type StateContext, set$ } from "@/state/state";
import type { ScrollTarget } from "@/types.internal";

function doesPlatformAdjustBreakScroll() {
    return PlatformAdjustBreaksScroll || Platform.OS === "macos";
}

export class ScrollAdjustHandler {
    private appliedAdjust = 0;
    private pendingAdjust = 0;
    private ctx: StateContext;

    constructor(ctx: StateContext) {
        this.ctx = ctx;
    }
    requestAdjust(add: number) {
        const scrollingTo = this.ctx.state.scrollingTo;
        const shouldDeferAdjust =
            doesPlatformAdjustBreakScroll() &&
            !!scrollingTo &&
            !scrollingTo.isInitialScroll &&
            (scrollingTo.animated || Platform.OS === "macos");

        if (shouldDeferAdjust) {
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
    commitPendingAdjust(scrollTarget: ScrollTarget) {
        if (doesPlatformAdjustBreakScroll()) {
            // On web and native platforms where adjustment can interfere with scrollTo,
            // defer the adjustment and apply one correction when scrolling finishes.
            const state = this.ctx.state;
            const pending = this.pendingAdjust;

            // Clear pending state
            this.pendingAdjust = 0;

            if (pending !== 0) {
                let targetScroll: number;

                // If we have a scroll target with an index, recalculate the correct
                // position based on where the target item is NOW, not just add pendingAdjust
                if (scrollTarget?.index !== undefined) {
                    // Get the target item's current position
                    const currentOffset = calculateOffsetForIndex(this.ctx, scrollTarget.index);
                    // Apply viewOffset and viewPosition to get the final scroll position
                    targetScroll = calculateOffsetWithOffsetPosition(this.ctx, currentOffset, scrollTarget);
                    targetScroll = clampScrollOffset(this.ctx, targetScroll, scrollTarget);
                } else {
                    // Fallback: just add pending to current scroll
                    targetScroll = clampScrollOffset(this.ctx, state.scroll + pending);
                }

                const adjustment = targetScroll - state.scrollPending;

                if (Math.abs(adjustment) > 0.1 || Math.abs(pending) > 0.1) {
                    this.appliedAdjust += adjustment;
                    state.scroll = targetScroll;

                    state.scrollForNextCalculateItemsInView = undefined;

                    set$(this.ctx, "scrollAdjust", this.appliedAdjust);
                }

                set$(this.ctx, "scrollAdjustPending", 0);
                calculateItemsInView(this.ctx);
            }
        }
    }
}
