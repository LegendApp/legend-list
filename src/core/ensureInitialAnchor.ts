import { calculateOffsetForIndex } from "@/core/calculateOffsetForIndex";
import { clampScrollOffset } from "@/core/clampScrollOffset";
import { getTopOffsetAdjustment } from "@/core/getTopOffsetAdjustment";
import type { StateContext } from "@/state/state";
import { getId } from "@/utils/getId";
import { getItemSize } from "@/utils/getItemSize";
import { requestAdjust } from "@/utils/requestAdjust";

const INITIAL_ANCHOR_TOLERANCE = 0.5;
const INITIAL_ANCHOR_MAX_ATTEMPTS = 4;
const INITIAL_ANCHOR_SETTLED_TICKS = 2;

export function ensureInitialAnchor(ctx: StateContext) {
    const state = ctx.state;
    const { initialAnchor } = state;
    if (!initialAnchor) {
        return;
    }

    if (state.initialScroll || state.scrollingTo?.isInitialScroll) {
        return;
    }

    if (!state.didContainersLayout) {
        return;
    }

    if (state.positions[initialAnchor.index] === undefined) {
        return;
    }

    const item = state.props.data[initialAnchor.index];
    const id = getId(state, initialAnchor.index);
    const size = getItemSize(ctx, id, initialAnchor.index, item, true, true);
    if (size === undefined) {
        return;
    }

    const availableSpace = Math.max(0, state.scrollLength - size);
    const desiredOffset =
        calculateOffsetForIndex(ctx, initialAnchor.index) +
        getTopOffsetAdjustment(ctx) -
        (initialAnchor.viewOffset ?? 0) -
        (initialAnchor.viewPosition ?? 0) * availableSpace;
    const clampedDesiredOffset = clampScrollOffset(ctx, desiredOffset, initialAnchor);
    const delta = clampedDesiredOffset - state.scroll;

    if (Math.abs(delta) <= INITIAL_ANCHOR_TOLERANCE) {
        const settledTicks = (initialAnchor.settledTicks ?? 0) + 1;
        if (settledTicks >= INITIAL_ANCHOR_SETTLED_TICKS) {
            state.initialAnchor = undefined;
        } else {
            initialAnchor.settledTicks = settledTicks;
        }
        return;
    }

    if ((initialAnchor.attempts ?? 0) >= INITIAL_ANCHOR_MAX_ATTEMPTS) {
        state.initialAnchor = undefined;
        return;
    }

    const lastDelta = initialAnchor.lastDelta;
    if (lastDelta !== undefined && Math.abs(delta) >= Math.abs(lastDelta)) {
        state.initialAnchor = undefined;
        return;
    }

    Object.assign(initialAnchor, {
        attempts: (initialAnchor.attempts ?? 0) + 1,
        lastDelta: delta,
        settledTicks: 0,
    });

    requestAdjust(ctx, delta);
}
