// biome-ignore lint/correctness/noUnusedImports: Leaving this out makes it crash in some environments
import * as React from "react";
import { type ForwardedRef, forwardRef, useCallback, useRef } from "react";
import { type Insets, Platform, type ScrollViewProps, StyleSheet } from "react-native";
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
import { IsNewArchitecture } from "@/constants-platform";
import { useCombinedRef } from "@/hooks/useCombinedRef";

type KeyboardControllerLegendListProps<ItemT> = Omit<AnimatedLegendListProps<ItemT>, "onScroll" | "contentInset"> & {
    onScroll?: (event: ReanimatedScrollEvent) => void;
    contentInset?: Insets | undefined;
    safeAreaInsets?: { top: number; bottom: number };
};

const calculateKeyboardInset = (height: number, safeAreaInsetBottom: number, isNewArchitecture: boolean) => {
    "worklet";
    return isNewArchitecture
        ? Math.max(0, height - safeAreaInsetBottom)
        : Math.max(isNewArchitecture ? 0 : -safeAreaInsetBottom, height - safeAreaInsetBottom * 2);
};

// biome-ignore lint/nursery/noShadow: const function name shadowing is intentional
export const KeyboardAvoidingLegendList = (forwardRef as TypedForwardRef)(function KeyboardAvoidingLegendList<ItemT>(
    props: KeyboardControllerLegendListProps<ItemT>,
    forwardedRef: ForwardedRef<LegendListRef>,
) {
    const {
        contentInset: contentInsetProp,
        horizontal,
        onScroll: onScrollProp,
        safeAreaInsets = { bottom: 0, top: 0 },
        style: styleProp,
        ...rest
    } = props;

    const styleFlattened = StyleSheet.flatten(styleProp) as ScrollViewProps;
    const refLegendList = useRef<LegendListRef | null>(null);
    const combinedRef = useCombinedRef(forwardedRef, refLegendList);

    const isIos = Platform.OS === "ios";
    const isAndroid = Platform.OS === "android";
    const scrollViewRef = useAnimatedRef<Animated.ScrollView>();
    const scrollOffsetY = useSharedValue(0);
    const animatedOffsetY = useSharedValue<number | null>(null);
    const scrollOffsetAtKeyboardStart = useSharedValue(0);
    const mode = useSharedValue<"idle" | "running">("idle");
    const keyboardInset = useSharedValue({ bottom: 0, top: 0 });
    const keyboardHeight = useSharedValue(0);
    const isOpening = useSharedValue(false);
    const didInteractive = useSharedValue(false);
    const { top: safeAreaInsetTop, bottom: safeAreaInsetBottom } = safeAreaInsets;
    // Track keyboard open state to ignore spurious iOS keyboard events
    const isKeyboardOpen = useSharedValue(false);

    const scrollHandler = useAnimatedScrollHandler(
        (event) => {
            scrollOffsetY.set(event.contentOffset[horizontal ? "x" : "y"]);

            if (onScrollProp) {
                runOnJS(onScrollProp)(event);
            }
        },
        [onScrollProp, horizontal],
    );

    const setScrollProcessingEnabled = useCallback(
        (enabled: boolean) => refLegendList.current?.setScrollProcessingEnabled(enabled),
        [refLegendList],
    );

    useKeyboardHandler(
        // biome-ignore assist/source/useSortedKeys: prefer start/move/end
        {
            onStart: (event) => {
                "worklet";

                mode.set("running");

                // Ignore spurious events when keyboard is already open
                if (isKeyboardOpen.get() && event.progress === 1 && event.height > 0) {
                    return;
                }

                if (!didInteractive.get()) {
                    if (event.height > 0) {
                        keyboardHeight.set(event.height - safeAreaInsetBottom);
                    }

                    isOpening.set(event.progress > 0);

                    scrollOffsetAtKeyboardStart.set(scrollOffsetY.get());
                    animatedOffsetY.set(scrollOffsetY.get());
                    runOnJS(setScrollProcessingEnabled)(false);
                }
            },
            onInteractive: (event) => {
                "worklet";

                if (mode.get() !== "running") {
                    runOnJS(setScrollProcessingEnabled)(false);
                }

                mode.set("running");

                if (!didInteractive.get()) {
                    didInteractive.set(true);
                }

                if (isAndroid && !horizontal) {
                    const newInset = calculateKeyboardInset(event.height, safeAreaInsetBottom, IsNewArchitecture);
                    keyboardInset.set({ bottom: newInset, top: safeAreaInsetTop * 2 });
                }
            },
            onMove: (event) => {
                "worklet";

                if (!didInteractive.get()) {
                    const vIsOpening = isOpening.get();
                    const vKeyboardHeight = keyboardHeight.get();
                    const vProgress = vIsOpening ? event.progress : 1 - event.progress;

                    const targetOffset = Math.max(
                        0,
                        scrollOffsetAtKeyboardStart.get() +
                            (vIsOpening ? vKeyboardHeight : -vKeyboardHeight) * vProgress,
                    );
                    scrollOffsetY.set(targetOffset);
                    animatedOffsetY.set(targetOffset);

                    if (!horizontal) {
                        const newInset = calculateKeyboardInset(event.height, safeAreaInsetBottom, IsNewArchitecture);
                        keyboardInset.set({ bottom: newInset, top: IsNewArchitecture ? 0 : safeAreaInsetTop * 2 });
                    }
                }
            },
            onEnd: (event) => {
                "worklet";

                const wasInteractive = didInteractive.get();

                const vMode = mode.get();
                mode.set("idle");

                if (vMode === "running") {
                    if (!wasInteractive) {
                        const vIsOpening = isOpening.get();
                        const vKeyboardHeight = keyboardHeight.get();

                        const targetOffset = Math.max(
                            0,
                            scrollOffsetAtKeyboardStart.get() +
                                (vIsOpening ? vKeyboardHeight : -vKeyboardHeight) *
                                    (vIsOpening ? event.progress : 1 - event.progress),
                        );

                        // Set both scrollOffsetY and animatedOffsetY so that it sets the new scroll position
                        // and also makes sure scrollOffsetY is up to date
                        scrollOffsetY.set(targetOffset);
                        animatedOffsetY.set(targetOffset);
                    }

                    runOnJS(setScrollProcessingEnabled)(true);

                    didInteractive.set(false);

                    isKeyboardOpen.set(event.height > 0);

                    if (!horizontal) {
                        const newInset = calculateKeyboardInset(event.height, safeAreaInsetBottom, IsNewArchitecture);
                        keyboardInset.set({ bottom: newInset, top: IsNewArchitecture ? 0 : safeAreaInsetTop * 2 });
                        if (newInset <= 0) {
                            animatedOffsetY.set(scrollOffsetY.get());
                        }
                    }
                }
            },
        },
        [scrollViewRef, safeAreaInsetBottom],
    );

    const animatedProps = useAnimatedProps<ScrollViewProps>(() => {
        "worklet";

        const vAnimatedOffsetY = animatedOffsetY.get() as number | null;

        // Setting contentOffset animates the scroll with the keyboard
        const baseProps: ScrollViewProps = {
            contentOffset:
                vAnimatedOffsetY === null
                    ? undefined
                    : {
                          x: 0,
                          y: vAnimatedOffsetY,
                      },
        };

        const { top: keyboardInsetTop, bottom: keyboardInsetBottom } = keyboardInset.get();

        // On iOS we can use contentInset to pad from the bottom
        return isIos
            ? Object.assign(baseProps, {
                  contentInset: {
                      bottom: (contentInsetProp?.bottom ?? 0) + (horizontal ? 0 : keyboardInsetBottom),
                      left: contentInsetProp?.left ?? 0,
                      right: contentInsetProp?.right ?? 0,
                      top: (contentInsetProp?.top ?? 0) - keyboardInsetTop,
                  },
              })
            : baseProps;
    });

    // contentInset is not supported on Android so we have to use marginBottom instead
    const style = isAndroid
        ? useAnimatedStyle(
              () => ({
                  ...(styleFlattened || {}),
                  marginBottom: keyboardInset.get().bottom ?? 0,
              }),
              [styleProp, keyboardInset],
          )
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
