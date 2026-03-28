import { getInitialBootstrapEffectiveScroll } from "@/core/initialBootstrap";
import { hasPendingDeferredGeometryBoundaryHandoff } from "@/core/deferredPositionState";
import type { StateContext } from "@/state/state";
import { checkThreshold } from "@/utils/checkThreshold";
import { logInitialScrollDebug } from "@/utils/debugInitialScroll";
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
        scrollLength,
        startReachedSnapshot,
        startReachedSnapshotDataChangeEpoch,
        totalSize,
    } = state;
    const scroll = getInitialBootstrapEffectiveScroll(state);

    const dataLength = data.length;
    const threshold = onStartReachedThreshold! * scrollLength;
    const dataChanged = startReachedSnapshotDataChangeEpoch !== dataChangeEpoch;
    const withinThreshold = threshold > 0 && Math.abs(scroll) <= threshold;
    const hasPendingDeferredBoundaryHandoff = hasPendingDeferredGeometryBoundaryHandoff(state);
    const shouldSuppressDeferredBoundaryStartReached =
        hasPendingDeferredBoundaryHandoff || !!state.pendingStartReachedAfterDeferredBoundaryHandoff;
    const allowReentryOnDataChange = !!isStartReached && withinThreshold && !!dataChanged && !isInMVCPActiveMode(state);

    if (shouldSuppressDeferredBoundaryStartReached) {
        if (hasPendingDeferredBoundaryHandoff && withinThreshold) {
            state.pendingStartReachedAfterDeferredBoundaryHandoff = true;
            return;
        }

        if (state.pendingStartReachedAfterDeferredBoundaryHandoff) {
            if (withinThreshold) {
                if (state.isStartReached === true) {
                    return;
                }

                state.pendingStartReachedAfterDeferredBoundaryHandoff = false;
                return;
            }

            state.pendingStartReachedAfterDeferredBoundaryHandoff = false;
        }
    }

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
        logInitialScrollDebug("start-reached-reset", {
            dataChanged: !!dataChanged,
            scroll,
            threshold,
            totalSize,
        });
        state.isStartReached = false;
        state.startReachedSnapshot = undefined;
        state.startReachedSnapshotDataChangeEpoch = undefined;
        if (dataChanged && Math.abs(state.scrollAdjustHandler.getAdjust()) > 0.1) {
            state.pendingStartReachedAfterDeferredBoundaryHandoff = true;
        }
    }

    state.isAtStart = scroll <= 0;

    // Data changed while still inside the start window. Wait for MVCP to settle,
    // then allow one re-fire for this data change epoch.
    if (isStartReached && withinThreshold && dataChanged && !allowReentryOnDataChange) {
        return;
    }

    const nextIsStartReached = checkThreshold(
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
    if (nextIsStartReached !== state.isStartReached || nextIsStartReached) {
        logInitialScrollDebug("check-at-top", {
            allowReentryOnDataChange,
            dataChanged: !!dataChanged,
            nextIsStartReached,
            previousIsStartReached: state.isStartReached,
            scroll,
            threshold,
        });
    }
    state.isStartReached = nextIsStartReached;
}
