// biome-ignore lint/correctness/noUnusedImports: Leaving this out makes it crash in some environments
import * as React from "react";
import { type ForwardedRef, forwardRef } from "react";
import { type Insets, Platform } from "react-native";
import { useKeyboardHandler } from "react-native-keyboard-controller";
import type Animated from "react-native-reanimated";
import {
    runOnJS,
    scrollTo,
    useAnimatedProps,
    useAnimatedRef,
    useAnimatedScrollHandler,
    useAnimatedStyle,
    useSharedValue,
} from "react-native-reanimated";
import type { ReanimatedScrollEvent } from "react-native-reanimated/lib/typescript/hook/commonTypes";

import type { LegendListRef, TypedForwardRef } from "@legendapp/list";
import { AnimatedLegendList, type AnimatedLegendListProps } from "@legendapp/list/reanimated";

type KeyboardControllerLegendListProps<ItemT> = Omit<AnimatedLegendListProps<ItemT>, "onScroll" | "contentInset"> & {
    onScroll?: (event: ReanimatedScrollEvent) => void;
    contentInset?: Insets;
    safeAreaInsetBottom?: number;
};

export const KeyboardAvoidingLegendList = (forwardRef as TypedForwardRef)(function KeyboardAvoidingLegendList<ItemT>(
    props: KeyboardControllerLegendListProps<ItemT>,
    forwardedRef: ForwardedRef<LegendListRef>,
) {
    const {
        contentInset: contentInsetProp,
        horizontal,
        onScroll: onScrollProp,
        scrollEventThrottle,
        safeAreaInsetBottom = 0,
        ...rest
    } = props;

    const resolvedScrollEventThrottle = scrollEventThrottle ?? 16;
    const scrollViewRef = useAnimatedRef<Animated.ScrollView>();
    const scrollOffsetY = useSharedValue(0);
    const scrollOffsetAtKeyboardStart = useSharedValue(0);
    const keyboardInset = useSharedValue(0);

    const scrollHandler = useAnimatedScrollHandler(
        (event) => {
            scrollOffsetY.value = event.contentOffset[horizontal ? "x" : "y"];

            if (onScrollProp) {
                runOnJS(onScrollProp)(event);
            }
        },
        [onScrollProp, horizontal],
    );

    useKeyboardHandler(
        // biome-ignore assist/source/useSortedKeys: prefer start/move/end
        {
            onStart: () => {
                "worklet";
                scrollOffsetAtKeyboardStart.value = scrollOffsetY.value;
            },
            onMove: (event) => {
                "worklet";
                const targetOffset = scrollOffsetAtKeyboardStart.value + event.height;
                scrollOffsetY.value = targetOffset;
                scrollTo(scrollViewRef, 0, targetOffset, false);
                if (!horizontal) {
                    keyboardInset.value = Math.max(0, event.height - safeAreaInsetBottom);
                }
            },
            onEnd: (event) => {
                "worklet";
                const targetOffset = scrollOffsetAtKeyboardStart.value + event.height;
                scrollOffsetY.value = targetOffset;
                scrollTo(scrollViewRef, 0, targetOffset, false);
                if (!horizontal) {
                    keyboardInset.value = Math.max(0, event.height - safeAreaInsetBottom);
                }
            },
        },
        [scrollViewRef, safeAreaInsetBottom],
    );

    const animatedProps =
        Platform.OS === "ios"
            ? useAnimatedProps(() => {
                  "worklet";

                  return {
                      contentInset: {
                          bottom: (contentInsetProp?.bottom ?? 0) + (horizontal ? 0 : keyboardInset.value),
                          left: contentInsetProp?.left ?? 0,
                          right: contentInsetProp?.right ?? 0,
                          top: contentInsetProp?.top ?? 0,
                      },
                  };
              })
            : undefined;

    const style =
        Platform.OS !== "ios"
            ? useAnimatedStyle(() => ({
                  marginBottom: keyboardInset.value,
              }))
            : undefined;

    return (
        <AnimatedLegendList
            {...rest}
            animatedProps={animatedProps}
            keyboardDismissMode="interactive"
            onScroll={scrollHandler as unknown as AnimatedLegendListProps<ItemT>["onScroll"]}
            ref={forwardedRef}
            refScrollView={scrollViewRef}
            scrollEventThrottle={resolvedScrollEventThrottle}
            scrollIndicatorInsets={{ bottom: 0, top: 0 }}
            style={style}
        />
    );
});

export { KeyboardAvoidingLegendList as LegendList };
