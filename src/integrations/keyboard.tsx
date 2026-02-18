// biome-ignore lint/correctness/noUnusedImports: Leaving this out makes it crash in some environments
import * as React from "react";
import { type ForwardedRef, forwardRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type Insets, Platform, type ScrollViewProps, StyleSheet } from "react-native";
import { useKeyboardHandler } from "react-native-keyboard-controller";
import type Animated from "react-native-reanimated";
import type { ScrollEvent as ReanimatedScrollEvent, ScrollHandlerProcessed } from "react-native-reanimated";
import {
    isWorkletFunction,
    runOnJS,
    useAnimatedProps,
    useAnimatedRef,
    useAnimatedScrollHandler,
    useAnimatedStyle,
    useComposedEventHandler,
    useSharedValue,
} from "react-native-reanimated";

import type { LegendListMetrics, LegendListRef, TypedForwardRef } from "@legendapp/list/react-native";
import { AnimatedLegendList, type AnimatedLegendListProps } from "@legendapp/list/reanimated";
import { useCombinedRef } from "@/hooks/useCombinedRef";

type KeyboardOnScrollCallback = (event: ReanimatedScrollEvent) => void;
type KeyboardOnScrollHandler = KeyboardOnScrollCallback | ScrollHandlerProcessed<Record<string, unknown>>;

type KeyboardControllerLegendListProps<ItemT> = Omit<
    AnimatedLegendListProps<ItemT>,
    "onScroll" | "contentInset" | "automaticallyAdjustContentInsets"
> & {
    onScroll?: KeyboardOnScrollHandler;
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
        contentContainerStyle: contentContainerStyleProp,
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
    const shouldUpdateAlignItemsAtEndMinSize = useSharedValue(false);
    // Track keyboard open state to ignore spurious iOS keyboard events
    const isKeyboardOpen = useSharedValue(false);
    const keyboardInsetRef = useRef(0);
    const [alignItemsAtEndMinSize, setAlignItemsAtEndMinSize] = useState<number | undefined>(undefined);
    const onScrollValue = onScrollProp as unknown;
    const onScrollCallback =
        typeof onScrollValue === "function" ? (onScrollValue as KeyboardOnScrollCallback) : undefined;
    const onScrollProcessed =
        onScrollValue && typeof onScrollValue === "object" && "workletEventHandler" in onScrollValue
            ? (onScrollValue as ScrollHandlerProcessed<Record<string, unknown>>)
            : null;
    const onScrollCallbackIsWorklet = useMemo(
        () => (onScrollCallback ? isWorkletFunction(onScrollCallback) : false),
        [onScrollCallback],
    );

    const scrollHandler = useAnimatedScrollHandler(
        (event) => {
            if (mode.get() !== "running" || didInteractive.get()) {
                scrollOffsetY.set(event.contentOffset[horizontal ? "x" : "y"]);
            }
            if (onScrollCallback) {
                if (onScrollCallbackIsWorklet) {
                    onScrollCallback(event);
                } else {
                    runOnJS(onScrollCallback)(event);
                }
            }
        },
        [horizontal, onScrollCallback, onScrollCallbackIsWorklet],
    );
    const composedScrollHandler = useComposedEventHandler([
        scrollHandler as ScrollHandlerProcessed<Record<string, unknown>>,
        onScrollProcessed as ScrollHandlerProcessed<Record<string, unknown>> | null,
    ]);
    const finalScrollHandler = onScrollProcessed ? composedScrollHandler : scrollHandler;

    const setScrollProcessingEnabled = useCallback(
        (enabled: boolean) => refLegendList.current?.setScrollProcessingEnabled(enabled),
        [refLegendList],
    );

    const reportContentInset = useCallback(
        (bottom: number) => refLegendList.current?.reportContentInset({ bottom }),
        [refLegendList],
    );

    const clearAlignItemsAtEndMinSize = useCallback(() => {
        setAlignItemsAtEndMinSize((prev) => (prev === undefined ? prev : undefined));
    }, []);

    const updateAlignItemsAtEndMinSize = useCallback(
        (nextKeyboardInset?: number) => {
            if (isAndroid) {
                return;
            }
            if (nextKeyboardInset !== undefined) {
                keyboardInsetRef.current = nextKeyboardInset;
            }

            if (!alignItemsAtEnd || horizontal) {
                clearAlignItemsAtEndMinSize();
                return;
            }

            const state = refLegendList.current?.getState();
            if (!state) {
                return;
            }

            const currentInset = keyboardInsetRef.current;
            if (currentInset <= 0) {
                clearAlignItemsAtEndMinSize();
                return;
            }
            if (state.scrollLength <= 0) {
                return;
            }

            const nextMinSize = Math.max(0, state.scrollLength - currentInset);
            setAlignItemsAtEndMinSize((prev) => (prev === nextMinSize ? prev : nextMinSize));
        },
        [alignItemsAtEnd, clearAlignItemsAtEndMinSize, horizontal],
    );

    const updateScrollMetrics = useCallback(() => {
        const state = refLegendList.current?.getState();
        if (!state) {
            return;
        }
        contentLength.set(state.contentLength);
        scrollLength.set(state.scrollLength);
        updateAlignItemsAtEndMinSize();
    }, [contentLength, scrollLength, updateAlignItemsAtEndMinSize]);

    const handleMetricsChange = useCallback(
        (metrics: LegendListMetrics) => {
            updateScrollMetrics();
            onMetricsChangeProp?.(metrics);
        },
        [onMetricsChangeProp, updateScrollMetrics],
    );

    useEffect(() => {
        updateAlignItemsAtEndMinSize();
    }, [updateAlignItemsAtEndMinSize]);

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
                    shouldUpdateAlignItemsAtEndMinSize.set(
                        !!alignItemsAtEnd && !horizontal && contentLength.get() < scrollLength.get(),
                    );

                    if (!shouldUpdateAlignItemsAtEndMinSize.get()) {
                        runOnJS(clearAlignItemsAtEndMinSize)();
                    }

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
                        runOnJS(updateAlignItemsAtEndMinSize)(vEffectiveKeyboardHeight);
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

                if (shouldUpdateAlignItemsAtEndMinSize.get() && !horizontal && alignItemsAtEnd) {
                    const vKeyboardHeight = calculateKeyboardInset(event.height, safeAreaInsetBottom);
                    const vEffectiveKeyboardHeight = calculateEffectiveKeyboardHeight(
                        vKeyboardHeight,
                        contentLength.get(),
                        scrollLength.get(),
                        alignItemsAtEnd,
                    );
                    runOnJS(updateAlignItemsAtEndMinSize)(vEffectiveKeyboardHeight);
                }
            },
            onMove: (event) => {
                "worklet";

                const vIsOpening = isOpening.get();

                if (isAndroid) {
                    if (!didInteractive.get()) {
                        const progress = clampProgress(event.progress);
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
                    }

                    if (!horizontal) {
                        const newInset = calculateKeyboardInset(event.height, safeAreaInsetBottom);
                        keyboardInset.set(newInset);
                    }
                }

                if (!horizontal && alignItemsAtEnd && !vIsOpening && shouldUpdateAlignItemsAtEndMinSize.get()) {
                    const vKeyboardHeight = calculateKeyboardInset(event.height, safeAreaInsetBottom);
                    const vEffectiveKeyboardHeight = calculateEffectiveKeyboardHeight(
                        vKeyboardHeight,
                        contentLength.get(),
                        scrollLength.get(),
                        alignItemsAtEnd,
                    );
                    runOnJS(updateAlignItemsAtEndMinSize)(vEffectiveKeyboardHeight);
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

                        if (!vIsOpening) {
                            runOnJS(updateAlignItemsAtEndMinSize)(newInset);
                        }

                        if (newInset <= 0) {
                            // Clear any stale animated offset once the keyboard is fully dismissed.
                            animatedOffsetY.set(scrollOffsetY.get());
                        }
                    }
                }
            },
        },
        [alignItemsAtEnd, horizontal, safeAreaInsetBottom, scrollViewRef],
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
        : styleProp;

    const contentContainerStyle = useMemo(() => {
        if (alignItemsAtEndMinSize === undefined) {
            return contentContainerStyleProp;
        }

        const minSizeStyle = horizontal ? { minWidth: alignItemsAtEndMinSize } : { minHeight: alignItemsAtEndMinSize };
        return contentContainerStyleProp ? [contentContainerStyleProp, minSizeStyle] : minSizeStyle;
    }, [alignItemsAtEndMinSize, contentContainerStyleProp, horizontal]);

    return (
        <AnimatedLegendList
            {...rest}
            animatedProps={animatedProps}
            automaticallyAdjustContentInsets={false}
            contentContainerStyle={contentContainerStyle}
            keyboardDismissMode="interactive"
            onMetricsChange={handleMetricsChange}
            onScroll={finalScrollHandler as unknown as AnimatedLegendListProps<ItemT>["onScroll"]}
            ref={combinedRef}
            refScrollView={scrollViewRef}
            scrollIndicatorInsets={{ bottom: 0, top: 0 }}
            style={style}
        />
    );
});

export { KeyboardAvoidingLegendList as LegendList };
