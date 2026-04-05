import { getInitialScrollSessionWatchdog, setInitialScrollSessionWatchdog } from "@/core/initialScrollSession";
import type { StateContext } from "@/state/state";

const INITIAL_SCROLL_MIN_TARGET_OFFSET = 1;

function didObserveInitialScrollProgress(
    newScroll: number,
    watchdog: NonNullable<NonNullable<StateContext["state"]["initialScrollSession"]>["completion"]>["watchdog"],
) {
    const previousDistance = Math.abs(watchdog.startScroll - watchdog.targetOffset);
    const nextDistance = Math.abs(newScroll - watchdog.targetOffset);
    return (
        nextDistance <= INITIAL_SCROLL_MIN_TARGET_OFFSET ||
        nextDistance + INITIAL_SCROLL_MIN_TARGET_OFFSET < previousDistance
    );
}

export function syncInitialScrollNativeWatchdog(
    state: StateContext["state"],
    options: {
        isInitialScroll: boolean | undefined;
        requestedOffset: number;
        targetOffset: number;
    },
) {
    const { isInitialScroll, requestedOffset, targetOffset } = options;
    const existingWatchdog = getInitialScrollSessionWatchdog(state);
    const shouldWatchInitialNativeScroll =
        !state.didFinishInitialScroll &&
        (isInitialScroll || !!existingWatchdog) &&
        targetOffset > INITIAL_SCROLL_MIN_TARGET_OFFSET;
    const shouldClearInitialNativeScrollWatchdog =
        !state.didFinishInitialScroll && !!existingWatchdog && requestedOffset <= INITIAL_SCROLL_MIN_TARGET_OFFSET;

    if (shouldWatchInitialNativeScroll) {
        state.hasScrolled = false;
        setInitialScrollSessionWatchdog(state, {
            startScroll: existingWatchdog?.startScroll ?? state.scroll,
            targetOffset,
        });
        return;
    }

    if (shouldClearInitialNativeScrollWatchdog) {
        setInitialScrollSessionWatchdog(state, undefined);
    }
}

export function trackInitialScrollNativeProgress(state: StateContext["state"], newScroll: number) {
    const initialNativeScrollWatchdog = getInitialScrollSessionWatchdog(state);
    const didInitialScrollProgress =
        !!initialNativeScrollWatchdog && didObserveInitialScrollProgress(newScroll, initialNativeScrollWatchdog);

    if (didInitialScrollProgress) {
        setInitialScrollSessionWatchdog(state, undefined);
        return;
    }

    if (initialNativeScrollWatchdog) {
        state.hasScrolled = false;
        setInitialScrollSessionWatchdog(state, initialNativeScrollWatchdog);
    }
}
