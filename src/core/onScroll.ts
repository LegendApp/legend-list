import { clearFinishedBootstrapInitialScrollTargetIfMovedAway } from "@/core/bootstrapInitialScroll";
import { interruptUserScroll } from "@/core/cancelScroll";
import { checkFinishedScroll } from "@/core/checkFinishedScroll";
import { clampScrollOffset } from "@/core/clampScrollOffset";
import { armAppScrollRearm } from "@/core/finishMaintainScrollAtEnd";
import { initialScrollWatchdog } from "@/core/initialScrollSession";
import { scrollTo } from "@/core/scrollTo";
import { maybeUpdateAnchoredEndSpace } from "@/core/updateAnchoredEndSpace";
import { updateScroll } from "@/core/updateScroll";
import { Platform } from "@/platform/Platform";
import type { NativeScrollEvent, NativeSyntheticEvent } from "@/platform/platform-types";
import { isScreenReaderEnabled } from "@/platform/screenReader";
import { peek$, type StateContext } from "@/state/state";
import { hasActiveInitialScroll } from "@/utils/hasActiveInitialScroll";
import { toLogicalHorizontalOffset } from "@/utils/rtl";

function trackInitialScrollNativeProgress(state: StateContext["state"], newScroll: number) {
    const initialNativeScrollWatchdog = initialScrollWatchdog.get(state);
    const didInitialScrollReachTarget =
        !!initialNativeScrollWatchdog && initialScrollWatchdog.didReachTarget(newScroll, initialNativeScrollWatchdog);

    if (didInitialScrollReachTarget) {
        initialScrollWatchdog.clear(state);
        return;
    }

    if (initialNativeScrollWatchdog) {
        state.hasScrolled = false;
        initialScrollWatchdog.set(state, {
            startScroll: initialNativeScrollWatchdog.startScroll,
            targetOffset: initialNativeScrollWatchdog.targetOffset,
        });
    }
}

function shouldDeferPublicOnScroll(state: StateContext["state"]) {
    return (
        Platform.OS === "web" &&
        !!state.initialScroll &&
        state.initialScrollSession?.kind === "bootstrap" &&
        !state.didFinishInitialScroll
    );
}

function cloneScrollEvent(event: NativeSyntheticEvent<NativeScrollEvent>): NativeSyntheticEvent<NativeScrollEvent> {
    return {
        ...event,
        nativeEvent: {
            ...event.nativeEvent,
        },
    };
}

export function onScroll(ctx: StateContext, event: NativeSyntheticEvent<NativeScrollEvent>, notify = true) {
    const state = ctx.state;
    const { scrollProcessingEnabled } = state;

    if (scrollProcessingEnabled === false) {
        return;
    }

    if (event.nativeEvent?.contentSize?.height === 0 && event.nativeEvent.contentSize?.width === 0) {
        return;
    }

    let insetChanged = false;
    if (event.nativeEvent?.contentInset) {
        const { contentInset } = event.nativeEvent;
        const prevInset = state.nativeContentInset;
        if (
            !prevInset ||
            prevInset.top !== contentInset.top ||
            prevInset.bottom !== contentInset.bottom ||
            prevInset.left !== contentInset.left ||
            prevInset.right !== contentInset.right
        ) {
            state.nativeContentInset = contentInset;
            insetChanged = true;
            if (Platform.OS !== "web" && state.props.anchoredEndSpaceOwner === "list") {
                maybeUpdateAnchoredEndSpace(ctx);
            }
        }
    }

    let newScroll = event.nativeEvent.contentOffset[state.props.horizontal ? "x" : "y"];
    if (state.props.horizontal) {
        newScroll = toLogicalHorizontalOffset(state, newScroll, event.nativeEvent.contentSize?.width);
    }
    const isFinishedEndInitialScroll =
        state.didFinishInitialScroll && state.initialScroll?.viewPosition === 1 && state.scroll > state.scrollLength;
    const shouldIgnoreNegativeInsetChange =
        Platform.OS !== "web" && insetChanged && newScroll < 0 && isFinishedEndInitialScroll;
    if (shouldIgnoreNegativeInsetChange) {
        return;
    }

    let nativeGeometryChanged = insetChanged;
    const nativeScreenReaderEnabled = Platform.OS !== "web" && isScreenReaderEnabled();
    if (Platform.OS !== "web") {
        const axis = state.props.horizontal ? "width" : "height";
        const content = event.nativeEvent.contentSize?.[axis];
        const length = event.nativeEvent.layoutMeasurement?.[axis];
        if (content !== undefined && length !== undefined) {
            const previousGeometry = state.nativeScrollGeometry;
            if (!previousGeometry || content !== previousGeometry.content || length !== previousGeometry.length) {
                nativeGeometryChanged ||= !!previousGeometry;
                state.nativeScrollGeometry = { content, length };
            }
            if (nativeScreenReaderEnabled) {
                const adjust = state.scrollAdjustHandler.getAdjust();
                const previous = state.accessibilityScrollEvent;
                // Native accessibility scrolls have no drag boundary. Infer only unowned motion
                // with stable geometry, skipping the first event after an ownership handoff.
                const time = Date.now();
                const blocked = !!(
                    state.scrollingTo ||
                    state.pendingScrollResolve ||
                    state.pendingScrollToEnd ||
                    state.maintainingScrollAtEnd ||
                    state.pendingMaintainScrollAtEnd ||
                    state.pendingEndMeasurements?.size ||
                    hasActiveInitialScroll(state) ||
                    state.scheduledWork.has("appScrollRearm") ||
                    state.isDragging ||
                    state.isMomentumScrolling ||
                    state.userScrollContentSize !== undefined ||
                    state.pendingNativeMVCPAdjust ||
                    peek$(ctx, "scrollAdjustPending") ||
                    state.ignoreScrollFromMVCP ||
                    insetChanged
                );
                const direction = previous ? Math.sign(newScroll - previous.scroll) : 0;
                const accepted =
                    previous &&
                    !blocked &&
                    !previous.blocked &&
                    content === previous.content &&
                    length === previous.length &&
                    adjust === previous.adjust &&
                    Math.abs(newScroll - previous.scroll) > 1;
                if (accepted) {
                    if (direction < 0) interruptUserScroll(ctx);
                    // A 250ms idle gap or reversal starts a burst; no cleanup timer is needed.
                    if (previous.time === undefined || time - previous.time > 250 || direction !== previous.direction) {
                        state.props.onUserScroll?.();
                    }
                }
                state.accessibilityScrollEvent = {
                    adjust,
                    blocked,
                    content,
                    direction: accepted ? direction : (previous?.direction ?? 0),
                    length,
                    scroll: newScroll,
                    time: accepted ? time : previous?.time,
                };
            }
        }
    }
    if (!nativeScreenReaderEnabled && state.accessibilityScrollEvent) {
        state.accessibilityScrollEvent = undefined;
    }

    state.lastNativeScroll = newScroll;
    state.lastNativeScrollTime = Date.now();
    if (state.scheduledWork.has("appScrollRearm")) armAppScrollRearm(ctx);

    // An animated request corrects its range on completion; snapping here would cut its motion.
    if (
        !state.props.hasExternalScroll &&
        state.scrollingTo &&
        !state.scrollingTo.animated &&
        state.scrollingTo.offset >= newScroll
    ) {
        const maxOffset = clampScrollOffset(ctx, newScroll, state.scrollingTo);
        if (newScroll !== maxOffset && Math.abs(newScroll - maxOffset) > 1) {
            // When JS state is already at this end, the instant scroll is in flight and this event predates it,
            // so re-sending would only duplicate the native command. Initial scrolls may not have dispatched yet.
            if (state.scrollingTo.isInitialScroll || Math.abs(state.scroll - maxOffset) > 1) {
                // If the scroll is past the end for some reason, clamp it to the end
                scrollTo(ctx, {
                    forceScroll: true,
                    isInitialScroll: true,
                    noScrollingTo: true,
                    offset: maxOffset,
                });
            }

            return;
        }
    }

    const previousScroll = state.scroll;
    const hadPreservedEndAnchorCorrection = !!state.preservedEndAnchorCorrection;
    state.scrollPending = newScroll;

    updateScroll(ctx, newScroll, insetChanged, { fromNativeScrollEvent: true, nativeGeometryChanged });
    trackInitialScrollNativeProgress(state, newScroll);
    // Rows measured at the new offset can start a correction; it must not pull back a scroll the list didn't make.
    clearFinishedBootstrapInitialScrollTargetIfMovedAway(
        ctx,
        !hadPreservedEndAnchorCorrection && Math.abs(newScroll - previousScroll) > 1,
    );

    if (state.scrollingTo) {
        checkFinishedScroll(ctx);
    }

    if (notify && state.props.onScroll) {
        if (shouldDeferPublicOnScroll(state)) {
            state.deferredPublicOnScrollEvent = cloneScrollEvent(event);
        } else {
            state.props.onScroll(event as any);
        }
    }
}
