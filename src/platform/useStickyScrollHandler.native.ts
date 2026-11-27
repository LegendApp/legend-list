import { type Ref, useCallback, useEffect, useRef } from "react";
import { Animated, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";

import { USER_MOMENTUM_WAIT_TIMEOUT_MS } from "@/constants";
import { getDataLength } from "@/core/IndexedData";
import { useCombinedRef } from "@/hooks/useCombinedRef";
import { useLatestRef } from "@/hooks/useLatestRef";
import type { LooseScrollView } from "@/platform/scrollview-types";
import { listen$, peek$, type StateContext, set$ } from "@/state/state";

// RN exports and uses this for ScrollView's own sticky headers, but does not
// include it in the handwritten Animated types.
const nativeAnimated = Animated as typeof Animated & {
    attachNativeEvent: (
        view: unknown,
        eventName: string,
        mapping: { nativeEvent: { contentOffset: { x?: Animated.Value; y?: Animated.Value } } }[],
    ) => { detach: () => void };
};

// Update only the JS copy. The event binding already drives the native node, and a
// native write runs after the next mount, where it can undo a newer native offset.
function copyOffsetToJs(value: Animated.Value, offset: number) {
    const jsValue = value as Animated.Value & { __onAnimatedValueUpdateReceived?: (value: number) => void };
    if (jsValue.__onAnimatedValueUpdateReceived) {
        jsValue.__onAnimatedValueUpdateReceived(offset);
    } else {
        value.setValue(offset);
    }
}

export function useStickyScrollHandler(
    stickyHeaderIndices: number[] | undefined,
    horizontal: boolean,
    ctx: StateContext,
    onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void,
    refScrollView: Ref<LooseScrollView | null>,
) {
    const viewRef = useRef<LooseScrollView | null>(null);
    const attachmentRef = useRef<{ detach: () => void } | undefined>(undefined);
    const targetRef = useRef<unknown>(undefined);
    const generationRef = useRef(0);
    const lastOffsetRef = useRef<number | undefined>(undefined);
    const hasStickyItems = stickyHeaderIndices?.some((index) => index >= 0 && index < getDataLength(ctx.state));
    const shouldUseRnAnimatedEngine = !ctx.state.props.stickyPositionComponentInternal;
    const isNativeSticky = hasStickyItems && shouldUseRnAnimatedEngine;
    const detach = useCallback(() => {
        generationRef.current++;
        attachmentRef.current?.detach();
        attachmentRef.current = undefined;
        targetRef.current = undefined;
    }, []);
    const attachRef = useLatestRef((target?: ReturnType<LooseScrollView["getScrollableNode"]>) => {
        detach();
        const nativeTarget = isNativeSticky ? (target ?? viewRef.current?.getScrollableNode()) : undefined;
        if (nativeTarget != null) {
            attachmentRef.current = nativeAnimated.attachNativeEvent(nativeTarget, "onScroll", [
                {
                    nativeEvent: {
                        contentOffset: { [horizontal ? "x" : "y"]: ctx.animatedScrollY as unknown as Animated.Value },
                    },
                },
            ]);
            targetRef.current = nativeTarget;
        }
    });
    const onRef = useCallback(
        (view: LooseScrollView | null) => {
            detach();
            viewRef.current = view;
            if (view) {
                const generation = generationRef.current;
                // A custom scroller can replace its native view in a child-only
                // commit. Bind after Animated's old children finish detaching.
                queueMicrotask(() => {
                    if (generation === generationRef.current) {
                        attachRef.current();
                    }
                });
            }
        },
        [attachRef, detach],
    );
    const ref = useCombinedRef(onRef, refScrollView);
    const scrollRef = useLatestRef((event: NativeSyntheticEvent<NativeScrollEvent>) => {
        if (isNativeSticky) {
            const offset = event.nativeEvent.contentOffset[horizontal ? "x" : "y"];
            lastOffsetRef.current = offset;
            const target = viewRef.current?.getScrollableNode();
            if (target != null && target !== targetRef.current) {
                // A stable imperative handle can hide an inner native view swap.
                // The first JS event identifies that target and supplies the offset
                // missed by the native mapping. setValue also flushes its attachment.
                attachRef.current(target);
                (ctx.animatedScrollY as unknown as Animated.Value).setValue(offset);
            }
        }
        onScroll(event);
    });
    const onStickyScroll = useCallback(
        (event: NativeSyntheticEvent<NativeScrollEvent>) => scrollRef.current(event),
        [scrollRef],
    );

    // Animated.event on Animated.ScrollView adds a JS value listener whose
    // removal races native observer cleanup on iOS. Sticky transforms only need
    // the native event connection. Rebind after commits because removing the
    // last sticky child can recreate the value's native node.
    useEffect(() => {
        attachRef.current();
        return detach;
    });

    // With no JS value listener, the JS copy of the offset stays stale, and Fabric
    // writes the transform it derives into the shadow tree when a scroll ends. Copy
    // the settled offset once so measure() reports pinned headers, as 3.7.2 did.
    // The setValue fallback also writes the native value, so never apply an offset
    // recorded before the binding changed, and skip settles with no new scroll events.
    useEffect(() => {
        if (!isNativeSticky) return;
        const { scheduledWork } = ctx.state;
        const settle = () => {
            const offset = lastOffsetRef.current;
            if (offset === undefined) return;
            lastOffsetRef.current = undefined;
            copyOffsetToJs(ctx.animatedScrollY as unknown as Animated.Value, offset);
            // Re-render sticky headers so a commit writes the settled transform.
            set$(ctx, "stickySettle", (peek$(ctx, "stickySettle") ?? 0) + 1);
        };
        // A fling release clears isScrollActive just before momentum begins; wait for it.
        // Scrolling again cancels the wait, so the settle only runs while inactive.
        const unlisten = listen$(ctx, "isScrollActive", (active) => {
            if (active) scheduledWork.cancel("stickySettle");
            else scheduledWork.timeout(settle, USER_MOMENTUM_WAIT_TIMEOUT_MS, "stickySettle");
        });
        return () => {
            unlisten();
            scheduledWork.cancel("stickySettle");
            lastOffsetRef.current = undefined;
        };
    }, [ctx, horizontal, isNativeSticky]);

    return { onScroll: isNativeSticky ? onStickyScroll : onScroll, refScrollView: ref };
}
