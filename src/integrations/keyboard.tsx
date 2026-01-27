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

import type { LegendListMetrics, LegendListRef, TypedForwardRef } from "@legendapp/list";
import { AnimatedLegendList, type AnimatedLegendListProps } from "@legendapp/list/reanimated";
import { useCombinedRef } from "@/hooks/useCombinedRef";

type KeyboardControllerLegendListProps<ItemT> = Omit<
    AnimatedLegendListProps<ItemT>,
    "onScroll" | "contentInset" | "automaticallyAdjustContentInsets"
> & {
    onScroll?: (event: ReanimatedScrollEvent) => void;
    contentInset?: Insets | undefined;
    safeAreaInsetBottom?: number;
};

const clampProgress = (progress: number) => {
    "worklet";
    // Clamp progress to 0..1 range. iOS can report progress > 1 on first keyboard open
    // when the keyboard height changes during animation (e.g., autocomplete bar appearing).
    return Math.min(1, Math.max(0, progress));
};

const calculateKeyboardInset = (height: number, safeAreaInsetBottom: number) => {
    "worklet";
    // Subtract safe area from keyboard height since iOS reports keyboard height including safe area.
    // Never return negative values.
    return Math.max(0, height - safeAreaInsetBottom);
};

const calculateEffectiveKeyboardHeight = (
    keyboardHeight: number,
    contentLength: number,
    scrollLength: number,
    alignItemsAtEnd: boolean | undefined,
) => {
    "worklet";
    if (alignItemsAtEnd) {
        return keyboardHeight;
    } else {
        const availableSpace = Math.max(0, scrollLength - contentLength);
        return Math.max(0, keyboardHeight - availableSpace);
    }
};

const calculateKeyboardTargetOffset = (
    startOffset: number,
    keyboardHeight: number,
    isOpening: boolean,
    progress: number,
) => {
    "worklet";
    // Normalized progress so 0..1 always means "how far through the keyboard transition we are".
    const normalizedProgress = isOpening ? progress : 1 - progress;
    const delta = (isOpening ? keyboardHeight : -keyboardHeight) * normalizedProgress;
    return Math.max(0, startOffset + delta);
};

// biome-ignore lint/nursery/noShadow: const function name shadowing is intentional
export const KeyboardAvoidingLegendList = (forwardRef as TypedForwardRef)(function KeyboardAvoidingLegendList<ItemT>(
    props: KeyboardControllerLegendListProps<ItemT>,
    forwardedRef: ForwardedRef<LegendListRef>,
) {
    const {
        contentInset: contentInsetProp,
        horizontal,
        onMetricsChange: onMetricsChangeProp,
        onScroll: onScrollProp,
        safeAreaInsetBottom = 0,
        style: styleProp,
        ...rest
    } = props;

    const { alignItemsAtEnd } = props;

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
    const keyboardInset = useSharedValue(0);
    const keyboardHeight = useSharedValue(0);
    const contentLength = useSharedValue(0);
    const scrollLength = useSharedValue(0);
    const isOpening = useSharedValue(false);
    const didInteractive = useSharedValue(false);
    // Track keyboard open state to ignore spurious iOS keyboard events
    const isKeyboardOpen = useSharedValue(false);

    const scrollHandler = useAnimatedScrollHandler(
        (event) => {
            if (mode.get() !== "running" || didInteractive.get()) {
                scrollOffsetY.set(event.contentOffset[horizontal ? "x" : "y"]);
            }
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

    const reportContentInset = useCallback(
        (bottom: number) => refLegendList.current?.reportContentInset({ bottom }),
        [refLegendList],
    );

    const updateScrollMetrics = useCallback(() => {
        const state = refLegendList.current?.getState();
        if (!state) {
            return;
        }
        contentLength.set(state.contentLength);
        scrollLength.set(state.scrollLength);
    }, [contentLength, scrollLength]);

    const handleMetricsChange = useCallback(
        (metrics: LegendListMetrics) => {
            updateScrollMetrics();
            onMetricsChangeProp?.(metrics);
        },
        [onMetricsChangeProp, updateScrollMetrics],
    );

    useKeyboardHandler(
        // biome-ignore assist/source/useSortedKeys: prefer start/move/end
        {
            onStart: (event) => {
                "worklet";

                mode.set("running");

                const progress = clampProgress(event.progress);

                // Ignore spurious events when keyboard is already open
                if (isKeyboardOpen.get() && progress >= 1 && event.height > 0) {
                    return;
                }

                if (!didInteractive.get()) {
                    if (event.height > 0) {
                        // Convert keyboard height into list space by removing the bottom safe-area.
                        keyboardHeight.set(event.height - safeAreaInsetBottom);
                    }

                    const vIsOpening = progress > 0;

                    isOpening.set(vIsOpening);

                    const vScrollOffset = scrollOffsetY.get();

                    // Snapshot the current scroll position to drive non-interactive keyboard animations.
                    scrollOffsetAtKeyboardStart.set(vScrollOffset);

                    if (isIos) {
                        const vContentLength = contentLength.get();
                        const vScrollLength = scrollLength.get();
                        const vKeyboardHeight = keyboardHeight.get();

                        const vEffectiveKeyboardHeight = calculateEffectiveKeyboardHeight(
                            vKeyboardHeight,
                            vContentLength,
                            vScrollLength,
                            alignItemsAtEnd,
                        );

                        const targetOffset = Math.max(
                            0,
                            vIsOpening
                                ? vScrollOffset + vEffectiveKeyboardHeight
                                : vScrollOffset - vEffectiveKeyboardHeight,
                        );
                        scrollOffsetY.set(targetOffset);
                        animatedOffsetY.set(targetOffset);
                        keyboardInset.set(vEffectiveKeyboardHeight);
                    } else if (isAndroid) {
                        animatedOffsetY.set(vScrollOffset);
                    }

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
                    const newInset = calculateKeyboardInset(event.height, safeAreaInsetBottom);
                    keyboardInset.set(newInset);
                }
            },
            onMove: isAndroid
                ? (event) => {
                      "worklet";

                      if (!didInteractive.get()) {
                          const progress = clampProgress(event.progress);
                          const vIsOpening = isOpening.get();
                          const vKeyboardHeight = keyboardHeight.get();
                          const vEffectiveKeyboardHeight = calculateEffectiveKeyboardHeight(
                              vKeyboardHeight,
                              contentLength.get(),
                              scrollLength.get(),
                              alignItemsAtEnd,
                          );

                          const targetOffset = calculateKeyboardTargetOffset(
                              scrollOffsetAtKeyboardStart.get(),
                              vEffectiveKeyboardHeight,
                              vIsOpening,
                              progress,
                          );

                          scrollOffsetY.set(targetOffset);
                          animatedOffsetY.set(targetOffset);

                          if (isAndroid && !horizontal) {
                              const newInset = calculateKeyboardInset(event.height, safeAreaInsetBottom);
                              keyboardInset.set(newInset);
                          }
                      }
                  }
                : undefined,
            onEnd: (event) => {
                "worklet";

                const wasInteractive = didInteractive.get();

                const vMode = mode.get();
                mode.set("idle");

                if (vMode === "running") {
                    const progress = clampProgress(event.progress);
                    const vKeyboardHeight = keyboardHeight.get();
                    const vEffectiveKeyboardHeight = calculateEffectiveKeyboardHeight(
                        vKeyboardHeight,
                        contentLength.get(),
                        scrollLength.get(),
                        alignItemsAtEnd,
                    );
                    const vIsOpening = isOpening.get();

                    if (!wasInteractive) {
                        const targetOffset = calculateKeyboardTargetOffset(
                            scrollOffsetAtKeyboardStart.get(),
                            vEffectiveKeyboardHeight,
                            vIsOpening,
                            progress,
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
                        const newInset = calculateKeyboardInset(event.height, safeAreaInsetBottom);
                        keyboardInset.set(newInset);

                        runOnJS(reportContentInset)(newInset);

                        if (newInset <= 0) {
                            // Clear any stale animated offset once the keyboard is fully dismissed.
                            animatedOffsetY.set(scrollOffsetY.get());
                        }
                    }
                }
            },
        },
        [alignItemsAtEnd, safeAreaInsetBottom, scrollViewRef],
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

        if (isIos) {
            const keyboardInsetBottom = keyboardInset.get();

            const contentInset = {
                bottom: (contentInsetProp?.bottom ?? 0) + (horizontal ? 0 : keyboardInsetBottom),
                left: contentInsetProp?.left ?? 0,
                right: contentInsetProp?.right ?? 0,
                top: contentInsetProp?.top ?? 0,
            };

            // On iOS we can use contentInset to pad from the bottom
            return Object.assign(baseProps, {
                contentInset,
            });
        } else {
            return baseProps;
        }
    });

    // contentInset is not supported on Android so we have to use marginBottom instead
    const style = isAndroid
        ? useAnimatedStyle(
              () => ({
                  ...(styleFlattened || {}),
                  marginBottom: keyboardInset.get(),
              }),
              [styleProp, keyboardInset],
          )
        : undefined;

    return (
        <AnimatedLegendList
            {...rest}
            animatedProps={animatedProps}
            automaticallyAdjustContentInsets={false}
            keyboardDismissMode="interactive"
            onMetricsChange={handleMetricsChange}
            onScroll={scrollHandler as unknown as AnimatedLegendListProps<ItemT>["onScroll"]}
            ref={combinedRef}
            refScrollView={scrollViewRef}
            scrollIndicatorInsets={{ bottom: 0, top: 0 }}
            style={style}
        />
    );
});

export { KeyboardAvoidingLegendList as LegendList };
