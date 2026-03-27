import { useCallback, useEffect, useRef } from "react";

import {
    ensureDeferredGeometryState,
    flushDeferredPositionStateBoundary,
    shouldDeferDeferredPositionRebaseForActiveMVCP,
} from "@/core/deferredPositionState";
import { isInitialBootstrapActive } from "@/core/initialBootstrap";
import { Platform } from "@/platform/Platform";
import type { NativeScrollEvent } from "@/platform/platform-types";
import { peek$, type StateContext } from "@/state/state";
import type { InternalState } from "@/types.base";
import { shouldUseSafariWebScrollIgnore } from "@/utils/shouldUseSafariWebScrollIgnore";

const DEFERRED_POSITION_SETTLE_MS = 500;

export function useDeferredPositionBoundaryFlush(params: {
    ctx: StateContext;
    horizontal: boolean;
    state: InternalState;
}) {
    const { ctx, horizontal, state } = params;
    const deferredPositionFlushTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const deferredPositionScrollDirectionRef = useRef(0);
    const shouldSkipSafariWebDeferredScrollEndIdleFlush = Platform.OS === "web" && shouldUseSafariWebScrollIgnore();

    const clearDeferredPositionFlushTimeout = useCallback(() => {
        if (deferredPositionFlushTimeoutRef.current !== undefined) {
            clearTimeout(deferredPositionFlushTimeoutRef.current);
            deferredPositionFlushTimeoutRef.current = undefined;
        }
    }, []);

    const scheduleDeferredPositionFlush = useCallback(
        (reason: "directionChange" | "scroll" | "scrollEnd") => {
            clearDeferredPositionFlushTimeout();
            const deferredGeometry = ensureDeferredGeometryState(state);
            deferredPositionFlushTimeoutRef.current = setTimeout(() => {
                if (shouldDeferDeferredPositionRebaseForActiveMVCP(state)) {
                    scheduleDeferredPositionFlush(reason);
                    return;
                }

                if (shouldSkipSafariWebDeferredScrollEndIdleFlush && Math.abs(deferredGeometry.delta) > 0.1) {
                    deferredPositionFlushTimeoutRef.current = undefined;
                    return;
                }

                deferredPositionFlushTimeoutRef.current = undefined;
                deferredPositionScrollDirectionRef.current = 0;
                flushDeferredPositionStateBoundary(ctx);
            }, DEFERRED_POSITION_SETTLE_MS);
        },
        [clearDeferredPositionFlushTimeout, ctx, shouldSkipSafariWebDeferredScrollEndIdleFlush, state],
    );

    const requestDeferredPositionFlush = useCallback(
        (reason: "directionChange" | "scrollEnd") => {
            clearDeferredPositionFlushTimeout();
            if (isInitialBootstrapActive(state)) {
                if (reason === "scrollEnd") {
                    deferredPositionScrollDirectionRef.current = 0;
                }
                return;
            }

            if (reason === "scrollEnd") {
                deferredPositionScrollDirectionRef.current = 0;
            }
            scheduleDeferredPositionFlush(reason);
        },
        [clearDeferredPositionFlushTimeout, scheduleDeferredPositionFlush, state],
    );

    useEffect(() => {
        return () => {
            clearDeferredPositionFlushTimeout();
        };
    }, [clearDeferredPositionFlushTimeout]);

    const onScroll = useCallback(
        (event: NativeScrollEvent) => {
            if (isInitialBootstrapActive(state)) {
                clearDeferredPositionFlushTimeout();
                deferredPositionScrollDirectionRef.current = 0;
                return;
            }
            const nextScroll = event.contentOffset[horizontal ? "x" : "y"];
            const previousScroll = state.scrollPending;
            const nextDirection = Math.sign(nextScroll - previousScroll);
            const previousDirection = deferredPositionScrollDirectionRef.current;
            const currentScrollAdjust = state.scrollAdjustHandler.getAdjust();
            const previousScrollAdjust = state.lastScrollAdjustForHistory ?? currentScrollAdjust;
            const scrollAdjustDelta = currentScrollAdjust - previousScrollAdjust;
            const scrollAdjustPending = peek$(ctx, "scrollAdjustPending") ?? 0;
            const hasSyntheticScrollState =
                Math.abs(scrollAdjustDelta) > 0.1 ||
                Math.abs(scrollAdjustPending) > 0.1 ||
                state.ignoreScrollFromMVCP !== undefined;

            if (nextDirection !== 0) {
                if (previousDirection !== 0 && previousDirection !== nextDirection) {
                    if (hasSyntheticScrollState) {
                        scheduleDeferredPositionFlush("scroll");
                        return;
                    }

                    deferredPositionScrollDirectionRef.current = nextDirection;
                    requestDeferredPositionFlush("directionChange");
                    return;
                }

                deferredPositionScrollDirectionRef.current = nextDirection;
            }
            scheduleDeferredPositionFlush("scroll");
        },
        [ctx, horizontal, requestDeferredPositionFlush, scheduleDeferredPositionFlush, state],
    );

    return {
        onScroll,
        onScrollEnd: () => requestDeferredPositionFlush("scrollEnd"),
    };
}
