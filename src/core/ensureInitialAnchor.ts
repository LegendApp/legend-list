import { calculateOffsetForIndex } from "@/core/calculateOffsetForIndex";
import { getContentSize, peek$, type StateContext } from "@/state/state";
import type { InternalState } from "@/types";
import { getId } from "@/utils/getId";
import { getItemSize } from "@/utils/getItemSize";
import { requestAdjust } from "@/utils/requestAdjust";

const INITIAL_ANCHOR_TOLERANCE = 0.5;
const INITIAL_ANCHOR_MAX_ATTEMPTS = 4;
const INITIAL_ANCHOR_SETTLED_TICKS = 2;

export function ensureInitialAnchor(ctx: StateContext, state: InternalState) {
    const anchor = state.initialAnchor!;

    const item = state.props.data[anchor.index];

    const containersDidLayout = peek$(ctx, "containersDidLayout");
    if (!containersDidLayout) {
        return;
    }

    const id = getId(state, anchor.index);
    if (state.positions.get(id) === undefined) {
        // Not laid out yet, wait for next pass
        return;
    }

    const size = getItemSize(ctx, state, id, anchor.index, item, true, true);
    if (size === undefined) {
        return;
    }

    const availableSpace = Math.max(0, state.scrollLength - size);
    const desiredOffset =
        calculateOffsetForIndex(ctx, state, anchor.index) -
        (anchor.viewOffset ?? 0) -
        (anchor.viewPosition ?? 0) * availableSpace;

    const contentSize = getContentSize(ctx);
    const maxOffset = Math.max(0, contentSize - state.scrollLength);
    const clampedDesiredOffset = Math.max(0, Math.min(desiredOffset, maxOffset));

    const delta = clampedDesiredOffset - state.scroll;

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

    requestAdjust(ctx, state, delta);
}
