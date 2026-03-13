import { calculateOffsetForIndex } from "@/core/calculateOffsetForIndex";
import { clampScrollOffset } from "@/core/clampScrollOffset";
import { getTopOffsetAdjustment } from "@/core/getTopOffsetAdjustment";
import type { StateContext } from "@/state/state";
import { debugInitialScroll } from "@/utils/debugInitialScroll";
import { getId } from "@/utils/getId";
import { getItemSize } from "@/utils/getItemSize";
import { requestAdjust } from "@/utils/requestAdjust";

const INITIAL_ANCHOR_TOLERANCE = 0.5;
const INITIAL_ANCHOR_MAX_ATTEMPTS = 4;
const INITIAL_ANCHOR_SETTLED_TICKS = 2;

export function ensureInitialAnchor(ctx: StateContext) {
    const state = ctx.state;
    const { initialAnchor, didContainersLayout, scroll, scrollLength } = state;
    const anchor = initialAnchor!;

    if (state.initialScroll || state.scrollingTo?.isInitialScroll) {
        // While initial scroll is still active, the dedicated initial-scroll replay owns retargeting.
        // Applying old-arch anchor compensation in the same window can double-apply layout deltas.
        debugInitialScroll("ensureInitialAnchor:skip-active-initial", {
            index: anchor.index,
            scroll: state.scroll,
            targetOffset: state.scrollingTo?.targetOffset,
        });
        return;
    }

    const item = state.props.data[anchor.index];

    if (!didContainersLayout) {
        return;
    }

    const id = getId(state, anchor.index);
    if (state.positions[anchor.index] === undefined) {
        // Not laid out yet, wait for next pass
        return;
    }

    const size = getItemSize(ctx, id, anchor.index, item, true, true);
    if (size === undefined) {
        return;
    }

    const availableSpace = Math.max(0, scrollLength - size);
    const topOffsetAdjustment = getTopOffsetAdjustment(ctx);
    const desiredOffset =
        calculateOffsetForIndex(ctx, anchor.index) +
        topOffsetAdjustment -
        (anchor.viewOffset ?? 0) -
        (anchor.viewPosition ?? 0) * availableSpace;

    const clampedDesiredOffset = clampScrollOffset(ctx, desiredOffset, anchor);

    const delta = clampedDesiredOffset - scroll;

    if (Math.abs(delta) <= INITIAL_ANCHOR_TOLERANCE) {
        const settledTicks = (anchor.settledTicks ?? 0) + 1;
        debugInitialScroll("ensureInitialAnchor:settled", {
            delta,
            index: anchor.index,
            scroll: state.scroll,
            settledTicks,
        });
        if (settledTicks >= INITIAL_ANCHOR_SETTLED_TICKS) {
            state.initialAnchor = undefined;
        } else {
            anchor.settledTicks = settledTicks;
        }
        return;
    }

    if ((anchor.attempts ?? 0) >= INITIAL_ANCHOR_MAX_ATTEMPTS) {
        state.initialAnchor = undefined;
        return;
    }

    const lastDelta = anchor.lastDelta;
    if (lastDelta !== undefined && Math.abs(delta) >= Math.abs(lastDelta)) {
        state.initialAnchor = undefined;
        return;
    }

    Object.assign(anchor, {
        attempts: (anchor.attempts ?? 0) + 1,
        lastDelta: delta,
        settledTicks: 0,
    });

    debugInitialScroll("ensureInitialAnchor:adjust", {
        attempts: anchor.attempts,
        delta,
        desiredOffset: clampedDesiredOffset,
        index: anchor.index,
        scroll,
    });
    requestAdjust(ctx, delta, undefined, { source: "ensureInitialAnchor" });
}
