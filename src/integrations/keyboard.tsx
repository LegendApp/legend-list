// biome-ignore lint/correctness/noUnusedImports: Leaving this out makes it crash in some environments
import * as React from "react";
import { type ForwardedRef, forwardRef, useCallback, useRef } from "react";
import { type Insets, Platform, type ScrollViewProps } from "react-native";
import { useKeyboardHandler } from "react-native-keyboard-controller";
import type Animated from "react-native-reanimated";
import {
    runOnJS,
    useAnimatedProps,
    useAnimatedRef,
    useAnimatedScrollHandler,
    useAnimatedStyle,
    useSharedValue,
} from "react-native-reanimated";
import type { ReanimatedScrollEvent } from "react-native-reanimated/lib/typescript/hook/commonTypes";

import type { LegendListRef, TypedForwardRef } from "@legendapp/list";
import { AnimatedLegendList, type AnimatedLegendListProps } from "@legendapp/list/reanimated";
import { useCombinedRef } from "@/hooks/useCombinedRef";

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
        safeAreaInsetBottom = 0,
        ...rest
    } = props;

    const refLegendList = useRef<LegendListRef | null>(null);
    const combinedRef = useCombinedRef(forwardedRef, refLegendList);

    const scrollViewRef = useAnimatedRef<Animated.ScrollView>();
    const scrollOffsetY = useSharedValue(0);
    const animatedOffsetY = useSharedValue<number | null>(null);
    const scrollOffsetAtKeyboardStart = useSharedValue(0);
    const keyboardInset = useSharedValue(0);
    const keyboardHeight = useSharedValue(0);
    const isOpening = useSharedValue(false);

    const scrollHandler = useAnimatedScrollHandler(
        (event) => {
            scrollOffsetY.value = event.contentOffset[horizontal ? "x" : "y"];

            if (onScrollProp) {
                runOnJS(onScrollProp)(event);
            }
        },
        [onScrollProp, horizontal],
    );

    const setScrollProcessingEnabled = useCallback(
        (enabled: boolean) => {
            refLegendList.current?.setScrollProcessingEnabled(enabled);
        },
        [refLegendList],
    );

    useKeyboardHandler(
        // biome-ignore assist/source/useSortedKeys: prefer start/move/end
        {
            onStart: (event) => {
                "worklet";

                if (event.height > 0) {
                    keyboardHeight.set(event.height - safeAreaInsetBottom);
                }

                isOpening.set(event.progress > 0);

                scrollOffsetAtKeyboardStart.value = scrollOffsetY.value;
                animatedOffsetY.set(scrollOffsetY.value);
                runOnJS(setScrollProcessingEnabled)(false);
            },
            onMove: (event) => {
                "worklet";

                const vIsOpening = isOpening.get();
                const vKeyboardHeight = keyboardHeight.get();
                const vProgress = vIsOpening ? event.progress : 1 - event.progress;

                const targetOffset =
                    scrollOffsetAtKeyboardStart.value + (vIsOpening ? vKeyboardHeight : -vKeyboardHeight) * vProgress;
                scrollOffsetY.value = targetOffset;
                animatedOffsetY.set(targetOffset);

                if (!horizontal) {
                    keyboardInset.value = Math.max(0, event.height - safeAreaInsetBottom);
                }
            },
            onEnd: (event) => {
                "worklet";

                const vIsOpening = isOpening.get();
                const vKeyboardHeight = keyboardHeight.get();

                const targetOffset =
                    scrollOffsetAtKeyboardStart.value +
                    (vIsOpening ? vKeyboardHeight : -vKeyboardHeight) *
                        (vIsOpening ? event.progress : 1 - event.progress);

                scrollOffsetY.value = targetOffset;
                animatedOffsetY.set(targetOffset);

                if (!horizontal) {
                    keyboardInset.value = Math.max(0, event.height - safeAreaInsetBottom);
                }
                runOnJS(setScrollProcessingEnabled)(true);
            },
        },
        [scrollViewRef, safeAreaInsetBottom],
    );

    const animatedProps = useAnimatedProps<ScrollViewProps>(() => {
        "worklet";

        // Setting contentOffset animates the scroll with the keyboard
        const baseProps: ScrollViewProps = {
            contentOffset:
                animatedOffsetY.value === null
                    ? undefined
                    : {
                          x: 0,
                          y: animatedOffsetY.value,
                      },
        };

        // On iOS we can use contentInset to pad from the bottom
        return Platform.OS === "ios"
            ? Object.assign(baseProps, {
                  contentInset: {
                      bottom: (contentInsetProp?.bottom ?? 0) + (horizontal ? 0 : keyboardInset.value),
                      left: contentInsetProp?.left ?? 0,
                      right: contentInsetProp?.right ?? 0,
                      top: contentInsetProp?.top ?? 0,
                  },
              })
            : baseProps;
    });

    // contentInset is not supported on Android so we have to use marginBottom instead
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
            ref={combinedRef}
            refScrollView={scrollViewRef}
            scrollIndicatorInsets={{ bottom: 0, top: 0 }}
            style={style}
        />
    );
});

export { KeyboardAvoidingLegendList as LegendList };
