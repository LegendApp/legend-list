import { useCallback, useEffect, useRef } from "react";

import {
    flushDeferredPositionStateBoundary,
    shouldDeferDeferredPositionRebaseForActiveMVCP,
} from "@/core/deferredPositionState";
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

    const scheduleDeferredPositionFlush = useCallback(() => {
        clearDeferredPositionFlushTimeout();
        deferredPositionFlushTimeoutRef.current = setTimeout(() => {
            if (shouldDeferDeferredPositionRebaseForActiveMVCP(state)) {
                scheduleDeferredPositionFlush();
                return;
            }

            if (shouldSkipSafariWebDeferredScrollEndIdleFlush && Math.abs(state.deferredPositionDelta) > 0.1) {
                deferredPositionFlushTimeoutRef.current = undefined;
                return;
            }

            deferredPositionFlushTimeoutRef.current = undefined;
            deferredPositionScrollDirectionRef.current = 0;
            flushDeferredPositionStateBoundary(ctx);
        }, DEFERRED_POSITION_SETTLE_MS);
    }, [clearDeferredPositionFlushTimeout, ctx, shouldSkipSafariWebDeferredScrollEndIdleFlush, state]);

    const flushDeferredPositionOnBoundary = useCallback(
        (reason: "directionChange" | "scrollEnd") => {
            clearDeferredPositionFlushTimeout();
            if (shouldDeferDeferredPositionRebaseForActiveMVCP(state)) {
                scheduleDeferredPositionFlush();
                return;
            }
            if (reason === "scrollEnd") {
                deferredPositionScrollDirectionRef.current = 0;
            }
            flushDeferredPositionStateBoundary(ctx);
        },
        [clearDeferredPositionFlushTimeout, ctx, scheduleDeferredPositionFlush, state],
    );

    useEffect(() => {
        return () => {
            clearDeferredPositionFlushTimeout();
        };
    }, [clearDeferredPositionFlushTimeout]);

    const onScroll = useCallback(
        (event: NativeScrollEvent) => {
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
                        scheduleDeferredPositionFlush();
                        return;
                    }

                    deferredPositionScrollDirectionRef.current = nextDirection;
                    flushDeferredPositionOnBoundary("directionChange");
                    return;
                }

                deferredPositionScrollDirectionRef.current = nextDirection;
            }
            scheduleDeferredPositionFlush();
        },
        [ctx, flushDeferredPositionOnBoundary, horizontal, scheduleDeferredPositionFlush, state],
    );

    return {
        onScroll,
        onScrollEnd: () => flushDeferredPositionOnBoundary("scrollEnd"),
    };
}
