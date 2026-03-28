import type { StateContext } from "@/state/state";
import { checkThreshold } from "@/utils/checkThreshold";
import { isInMVCPActiveMode } from "@/utils/isInMVCPActiveMode";

export function checkAtTop(ctx: StateContext) {
    const state = ctx?.state;
    if (!state || state.initialScroll || state.scrollingTo) {
        return;
    }
    const {
        dataChangeEpoch,
        isStartReached,
        props: { data, onStartReachedThreshold },
        scroll,
        scrollLength,
        startReachedSnapshot,
        startReachedSnapshotDataChangeEpoch,
    } = state;
    const totalSize = ctx.values.get("totalSize") ?? 0;

    const dataLength = data.length;
    const threshold = onStartReachedThreshold! * scrollLength;
    const dataChanged = startReachedSnapshotDataChangeEpoch !== dataChangeEpoch;
    const withinThreshold = threshold > 0 && Math.abs(scroll) <= threshold;
    const allowReentryOnDataChange = !!isStartReached && withinThreshold && !!dataChanged && !isInMVCPActiveMode(state);

    // If data changes and pushes us back outside the start window, immediately
    // clear the start latch so a fast return to the top can trigger again.
    if (
        isStartReached &&
        threshold > 0 &&
        scroll > threshold &&
        startReachedSnapshot &&
        (dataChanged ||
            startReachedSnapshot.contentSize !== totalSize ||
            startReachedSnapshot.dataLength !== dataLength)
    ) {
        state.isStartReached = false;
        state.startReachedSnapshot = undefined;
        state.startReachedSnapshotDataChangeEpoch = undefined;
    }

    state.isAtStart = scroll <= 0;

    // Data changed while still inside the start window. Wait for MVCP to settle,
    // then allow one re-fire for this data change epoch.
    if (isStartReached && withinThreshold && dataChanged && !allowReentryOnDataChange) {
        return;
    }

    state.isStartReached = checkThreshold(
        scroll,
        false,
        threshold,
        state.isStartReached,
        allowReentryOnDataChange ? undefined : startReachedSnapshot,
        {
            contentSize: totalSize,
            dataLength,
            scrollPosition: scroll,
        },
        (distance) => state.props.onStartReached?.({ distanceFromStart: distance }),
        (snapshot) => {
            state.startReachedSnapshot = snapshot;
            state.startReachedSnapshotDataChangeEpoch = snapshot ? dataChangeEpoch : undefined;
        },
        allowReentryOnDataChange,
    );
}
