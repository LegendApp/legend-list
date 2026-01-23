// biome-ignore lint/correctness/noUnusedImports: Leaving this out makes it crash in some environments
import * as React from "react";
import { type ForwardedRef, forwardRef, useCallback, useRef } from "react";
import { type Insets, Platform, type ScrollViewProps, StyleSheet } from "react-native";
import { useKeyboardHandler } from "react-native-keyboard-controller";
import type Animated from "react-native-reanimated";
import {
    runOnJS,
    runOnUI,
    useAnimatedProps,
    useAnimatedRef,
    useAnimatedScrollHandler,
    useAnimatedStyle,
    useSharedValue,
} from "react-native-reanimated";
import type { ReanimatedScrollEvent } from "react-native-reanimated/lib/typescript/hook/commonTypes";

import type { LegendListMetrics, LegendListRef, TypedForwardRef } from "@legendapp/list";
import { AnimatedLegendList, type AnimatedLegendListProps } from "@legendapp/list/reanimated";
import { IsNewArchitecture } from "@/constants-platform";
import { useCombinedRef } from "@/hooks/useCombinedRef";

type KeyboardControllerLegendListProps<ItemT> = Omit<AnimatedLegendListProps<ItemT>, "onScroll" | "contentInset"> & {
    onScroll?: (event: ReanimatedScrollEvent) => void;
    contentInset?: Insets | undefined;
    safeAreaInsets?: { top: number; bottom: number };
};

const clampProgress = (progress: number) => {
    "worklet";
    // Clamp progress to 0..1 range. iOS can report progress > 1 on first keyboard open
    // when the keyboard height changes during animation (e.g., autocomplete bar appearing).
    return Math.min(1, Math.max(0, progress));
};

const calculateKeyboardInset = (height: number, safeAreaInsetBottom: number, isNewArchitecture: boolean) => {
    "worklet";
    return isNewArchitecture
        ? Math.max(0, height - safeAreaInsetBottom)
        : Math.max(isNewArchitecture ? 0 : -safeAreaInsetBottom, height - safeAreaInsetBottom * 2);
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

const calculateEndPaddingInset = (keyboardHeight: number, alignItemsAtEndPadding: number) => {
    "worklet";
    // Limit end padding so it never exceeds the portion covered by the keyboard.
    return Math.min(keyboardHeight, alignItemsAtEndPadding);
};

const calculateTopInset = (safeAreaInsetTop: number, isNewArchitecture: boolean, extraTopInset: number) => {
    "worklet";
    // Legacy iOS doubles the top inset; extraTopInset keeps end-aligned content visible.
    return (isNewArchitecture ? 0 : safeAreaInsetTop * 2) + extraTopInset;
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
        safeAreaInsets = { bottom: 0, top: 0 },
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
    const keyboardInset = useSharedValue({ bottom: 0, top: 0 });
    const keyboardHeight = useSharedValue(0);
    const contentLength = useSharedValue(0);
    const scrollLength = useSharedValue(0);
    const alignItemsAtEndPadding = useSharedValue(0);
    const isOpening = useSharedValue(false);
    const didInteractive = useSharedValue(false);
    const { top: safeAreaInsetTop, bottom: safeAreaInsetBottom } = safeAreaInsets;
    // Track keyboard open state to ignore spurious iOS keyboard events
    const isKeyboardOpen = useSharedValue(false);

    const scrollHandler = useAnimatedScrollHandler(
        (event) => {
            if (mode.get() !== "running") {
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
            const nextPadding = metrics.alignItemsAtEndPadding || 0;
            alignItemsAtEndPadding.set(nextPadding);

            if (!horizontal) {
                // If the keyboard is open, update the keyboard inset
                runOnUI((padding: number, safeInsetTop: number, isNewArchitecture: boolean) => {
                    "worklet";
                    if (!isKeyboardOpen.get()) {
                        return;
                    }

                    const vKeyboardHeight = keyboardHeight.get();
                    const vEffectiveKeyboardHeight = calculateEffectiveKeyboardHeight(
                        vKeyboardHeight,
                        contentLength.get(),
                        scrollLength.get(),
                        alignItemsAtEnd,
                    );
                    const vTopInset = calculateEndPaddingInset(vEffectiveKeyboardHeight, padding);
                    const topInset = calculateTopInset(safeInsetTop, isNewArchitecture, vTopInset);
                    keyboardInset.set({
                        bottom: keyboardInset.get().bottom,
                        top: topInset,
                    });
                })(nextPadding, safeAreaInsetTop, IsNewArchitecture);
            }
            onMetricsChangeProp?.(metrics);
        },
        [
            alignItemsAtEndPadding,
            horizontal,
            isKeyboardOpen,
            keyboardHeight,
            keyboardInset,
            onMetricsChangeProp,
            safeAreaInsetTop,
            updateScrollMetrics,
        ],
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

                    isOpening.set(progress > 0);

                    // Snapshot the current scroll position to drive non-interactive keyboard animations.
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
                    if (!isAndroid && !IsNewArchitecture) {
                        keyboardInset.set({
                            bottom: keyboardInset.get().bottom,
                            // Legacy iOS uses a doubled top inset to keep content below the status bar.
                            top: calculateTopInset(safeAreaInsetTop, IsNewArchitecture, 0),
                        });
                    }
                    didInteractive.set(true);
                }

                if (isAndroid && !horizontal) {
                    const newInset = calculateKeyboardInset(event.height, safeAreaInsetBottom, IsNewArchitecture);
                    // Android relies on a simulated inset; keep top padding consistent with iOS.
                    keyboardInset.set({ bottom: newInset, top: safeAreaInsetTop * 2 });
                }
            },
            onMove: (event) => {
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
                    const vAlignItemsPadding = alignItemsAtEndPadding.get();
                    const vTopInset = calculateEndPaddingInset(vEffectiveKeyboardHeight, vAlignItemsPadding);

                    const targetOffset = calculateKeyboardTargetOffset(
                        scrollOffsetAtKeyboardStart.get(),
                        vEffectiveKeyboardHeight,
                        vIsOpening,
                        progress,
                    );

                    scrollOffsetY.set(targetOffset);
                    animatedOffsetY.set(targetOffset);

                    if (!horizontal) {
                        // Keep insets aligned with the moving keyboard during non-interactive updates.
                        const newInset = calculateKeyboardInset(event.height, safeAreaInsetBottom, IsNewArchitecture);
                        const topInset = calculateTopInset(
                            safeAreaInsetTop,
                            IsNewArchitecture,
                            vIsOpening ? vTopInset : 0,
                        );
                        keyboardInset.set({
                            bottom: newInset,
                            // Add top padding only while opening to keep end-aligned items visible.
                            top: topInset,
                        });
                    }
                }
            },
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
                    const vAlignItemsPadding = alignItemsAtEndPadding.get();
                    const vTopInset = calculateEndPaddingInset(vEffectiveKeyboardHeight, vAlignItemsPadding);
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
                        const newInset = calculateKeyboardInset(event.height, safeAreaInsetBottom, IsNewArchitecture);
                        const topInset = calculateTopInset(
                            safeAreaInsetTop,
                            IsNewArchitecture,
                            event.height > 0 ? vTopInset : 0,
                        );
                        keyboardInset.set({
                            bottom: newInset,
                            // Preserve end-aligned padding only while the keyboard is visible.
                            top: topInset,
                        });
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
