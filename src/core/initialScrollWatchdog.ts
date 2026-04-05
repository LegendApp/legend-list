import { setInitialScrollSession } from "@/core/initialScrollSession";
import type { StateContext } from "@/state/state";

const INITIAL_SCROLL_MIN_TARGET_OFFSET = 1;

function ensureInitialScrollWatchdogSessionCompletion(state: StateContext["state"]) {
    let session = state.initialScrollSession ?? setInitialScrollSession(state, { kind: "bootstrap" });
    if (!session) {
        session = {
            completion: {},
            kind: "bootstrap",
            previousDataLength: 0,
        };
        state.initialScrollSession = session;
    }

    session.completion ??= {};
    return session.completion;
}

function getInitialScrollWatchdog(state: StateContext["state"]) {
    return state.initialScrollSession?.completion?.watchdog;
}

function setInitialScrollWatchdog(
    state: StateContext["state"],
    watchdog: NonNullable<NonNullable<StateContext["state"]["initialScrollSession"]>["completion"]>["watchdog"],
) {
    if (!watchdog && !state.initialScrollSession?.completion?.watchdog) {
        return;
    }

    const completion = ensureInitialScrollWatchdogSessionCompletion(state);
    completion.watchdog = watchdog
        ? {
              startScroll: watchdog.startScroll,
              targetOffset: watchdog.targetOffset,
          }
        : undefined;
}

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
    const existingWatchdog = getInitialScrollWatchdog(state);
    const shouldWatchInitialNativeScroll =
        !state.didFinishInitialScroll &&
        (isInitialScroll || !!existingWatchdog) &&
        targetOffset > INITIAL_SCROLL_MIN_TARGET_OFFSET;
    const shouldClearInitialNativeScrollWatchdog =
        !state.didFinishInitialScroll && !!existingWatchdog && requestedOffset <= INITIAL_SCROLL_MIN_TARGET_OFFSET;

    if (shouldWatchInitialNativeScroll) {
        state.hasScrolled = false;
        setInitialScrollWatchdog(state, {
            startScroll: existingWatchdog?.startScroll ?? state.scroll,
            targetOffset,
        });
        return;
    }

    if (shouldClearInitialNativeScrollWatchdog) {
        setInitialScrollWatchdog(state, undefined);
    }
}

export function trackInitialScrollNativeProgress(state: StateContext["state"], newScroll: number) {
    const initialNativeScrollWatchdog = getInitialScrollWatchdog(state);
    const didInitialScrollProgress =
        !!initialNativeScrollWatchdog && didObserveInitialScrollProgress(newScroll, initialNativeScrollWatchdog);

    if (didInitialScrollProgress) {
        setInitialScrollWatchdog(state, undefined);
        return;
    }

    if (initialNativeScrollWatchdog) {
        state.hasScrolled = false;
        setInitialScrollWatchdog(state, initialNativeScrollWatchdog);
    }
}
