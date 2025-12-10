import { calculateOffsetForIndex } from "@/core/calculateOffsetForIndex";
import { clampScrollOffset } from "@/core/clampScrollOffset";
import { finishScrollTo } from "@/core/finishScrollTo";
import type { StateContext } from "@/state/state";
import { getId } from "@/utils/getId";
import { getItemSize } from "@/utils/getItemSize";
import { requestAdjust } from "@/utils/requestAdjust";

const INITIAL_ANCHOR_TOLERANCE = 0.5;
const INITIAL_ANCHOR_MAX_ATTEMPTS = 4;
const INITIAL_ANCHOR_SETTLED_TICKS = 2;

export function ensureInitialAnchor(ctx: StateContext) {
    const state = ctx.state;
    const { initialAnchor, didContainersLayout, positions, scroll, scrollLength } = state;
    const anchor = initialAnchor!;

    const item = state.props.data[anchor.index];

    if (!didContainersLayout) {
        return;
    }

    const id = getId(state, anchor.index);
    if (positions.get(id) === undefined) {
        // Not laid out yet, wait for next pass
        return;
    }

    const size = getItemSize(ctx, id, anchor.index, item, true, true);
    if (size === undefined) {
        return;
    }

    const availableSpace = Math.max(0, scrollLength - size);
    const desiredOffset =
        calculateOffsetForIndex(ctx, anchor.index) -
        (anchor.viewOffset ?? 0) -
        (anchor.viewPosition ?? 0) * availableSpace;

    const clampedDesiredOffset = clampScrollOffset(ctx, desiredOffset);

    const delta = clampedDesiredOffset - scroll;

    if (Math.abs(delta) <= INITIAL_ANCHOR_TOLERANCE) {
        const settledTicks = (anchor.settledTicks ?? 0) + 1;
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

    requestAdjust(ctx, delta);

    requestAnimationFrame(() => finishScrollTo(ctx));
}
