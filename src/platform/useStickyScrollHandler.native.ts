import { type Ref, useCallback, useEffect, useRef } from "react";
import { Animated, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";

import { useCombinedRef } from "@/hooks/useCombinedRef";
import { useLatestRef } from "@/hooks/useLatestRef";
import type { LooseScrollView } from "@/platform/scrollview-types";
import type { StateContext } from "@/state/state";

// RN exports and uses this for ScrollView's own sticky headers, but does not
// include it in the handwritten Animated types.
const nativeAnimated = Animated as typeof Animated & {
    attachNativeEvent: (
        view: unknown,
        eventName: string,
        mapping: { nativeEvent: { contentOffset: { x?: Animated.Value; y?: Animated.Value } } }[],
    ) => { detach: () => void };
};

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
    const hasStickyItems = stickyHeaderIndices?.some((index) => index >= 0 && index < ctx.state.props.data.length);
    const shouldUseRnAnimatedEngine = !ctx.state.props.stickyPositionComponentInternal;
    const detach = useCallback(() => {
        generationRef.current++;
        attachmentRef.current?.detach();
        attachmentRef.current = undefined;
        targetRef.current = undefined;
    }, []);
    const attachRef = useLatestRef((target?: ReturnType<LooseScrollView["getScrollableNode"]>) => {
        detach();
        const nativeTarget =
            hasStickyItems && shouldUseRnAnimatedEngine ? (target ?? viewRef.current?.getScrollableNode()) : undefined;
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
        if (hasStickyItems && shouldUseRnAnimatedEngine) {
            const target = viewRef.current?.getScrollableNode();
            if (target != null && target !== targetRef.current) {
                // A stable imperative handle can hide an inner native view swap.
                // The first JS event identifies that target and supplies the offset
                // missed by the native mapping. setValue also flushes its attachment.
                attachRef.current(target);
                (ctx.animatedScrollY as unknown as Animated.Value).setValue(
                    event.nativeEvent.contentOffset[horizontal ? "x" : "y"],
                );
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

    return { onScroll: hasStickyItems && shouldUseRnAnimatedEngine ? onStickyScroll : onScroll, refScrollView: ref };
}
