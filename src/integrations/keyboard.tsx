// biome-ignore lint/style/useImportType: Leaving this out makes it crash in some environments
import * as React from "react";
import { type ForwardedRef, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { LayoutChangeEvent, ScrollViewProps, View } from "react-native";
import { Platform } from "react-native";
import {
    KeyboardChatScrollView,
    type KeyboardChatScrollViewProps,
    KeyboardController,
    useKeyboardHandler,
} from "react-native-keyboard-controller";
import Reanimated, {
    makeMutable,
    runOnJS,
    runOnUI,
    type SharedValue,
    scrollTo,
    useAnimatedReaction,
    useAnimatedRef,
    useAnimatedStyle,
    useScrollViewOffset,
    useSharedValue,
} from "react-native-reanimated";

import type { AnchoredEndSpaceConfig } from "@legendapp/list/react";
import type { LegendListRef } from "@legendapp/list/react-native";
import { internal } from "@legendapp/list/react-native";
import { AnimatedLegendList, type AnimatedLegendListProps } from "@legendapp/list/reanimated";

const { typedForwardRef, useCombinedRef } = internal;

type ContentExtentProps = {
    children: React.ReactNode;
    committedSize: number;
    horizontal: boolean;
    sizeAdjustment: number;
};

/**
 * The list commits a shrinking content extent through React, which mounts at once, while the
 * blank space that grows to compensate waits for Reanimated's next frame, so the offset clamps
 * in between. Hold the extent on Reanimated's side and release it from a layout effect: that
 * write is queued after both the grown blank space (written when the shrink was measured) and
 * React's mount of the rows and ScrollAdjust (which carries MVCP), so the extent shrinks with or
 * after the larger inset and never ahead of MVCP. In one commit iOS applies contentInset before
 * contentSize and Android applies padding before child layout. Growth still lands at once
 * through the inner Animated size, ahead of the blank space shrinking.
 */
function ReanimatedContentExtent({ children, committedSize, horizontal, sizeAdjustment }: ContentExtentProps) {
    const size = Math.max(0, committedSize + sizeAdjustment);
    const extent = useSharedValue<number>(size);
    useLayoutEffect(() => {
        // runOnUI rather than a `.value` write: a JS-thread write reaches the UI runtime as its own
        // job, while runOnUI calls from one JS tick flush as one job behind earlier ones.
        runOnUI((next: number) => {
            "worklet";
            extent.value = next;
        })(size);
    }, [extent, size]);
    const style = useAnimatedStyle(
        () => (horizontal ? { minWidth: extent.value } : { minHeight: extent.value }),
        [horizontal],
    );

    return <Reanimated.View style={style}>{children}</Reanimated.View>;
}

if (typeof __DEV__ !== "undefined" && __DEV__ && !KeyboardChatScrollView) {
    console.warn(
        "[legend-list] KeyboardAwareLegendList requires a recent react-native-keyboard-controller with KeyboardChatScrollView. Please upgrade react-native-keyboard-controller to at least 1.21.7.",
    );
}

type KeyboardChatScrollViewPropsUnique = Omit<
    KeyboardChatScrollViewProps,
    | keyof ScrollViewProps
    | "inverted"
    | "ScrollViewComponent"
    | "blankSpace"
    | "extraContentPadding"
    | "onContentInsetChange"
    | "offset"
>;

type KeyboardAwareLegendListProps<ItemT> = Omit<
    AnimatedLegendListProps<ItemT>,
    "anchoredEndSpace" | "contentInsetEndAdjustment" | "renderScrollComponent"
> &
    KeyboardChatScrollViewPropsUnique & {
        anchoredEndSpace?: AnchoredEndSpaceConfig;
        contentInsetEndAdjustment?: SharedValue<number>;
        keyboardOffset?: number;
    };

type KeyboardChatScrollViewContentInsets = Parameters<
    NonNullable<KeyboardChatScrollViewProps["onContentInsetChange"]>
>[0];

type KeyboardViewabilityListRef = LegendListRef & {
    reportViewabilityInsetEndInternal?: (inset: number) => void;
    reportContentInsetForScrollInternal?: LegendListRef["reportContentInset"];
};

type ScrollMessageToEndOptions = {
    animated: boolean;
    closeKeyboard: boolean;
};

type KeyboardScrollToEndListRef = {
    current: {
        scrollToEnd: LegendListRef["scrollToEnd"];
    } | null;
};

type UseKeyboardScrollToEndOptions = {
    freeze?: SharedValue<boolean>;
    listRef: KeyboardScrollToEndListRef;
};

type KeyboardChatComposerInsetListRef = {
    current: Pick<LegendListRef, "reportContentInset"> | null;
};

type KeyboardChatComposerRef = {
    current: Pick<View, "measure"> | null;
};

export function useKeyboardChatComposerInset(
    _listRef: KeyboardChatComposerInsetListRef,
    composerRef: KeyboardChatComposerRef,
    initialHeight = 0,
) {
    // Keep the list ref parameter for compatibility. KeyboardChatScrollView owns reporting its
    // combined keyboard + composer inset; this hook only updates the composer shared value.
    const contentInsetEndAdjustment = useSharedValue(initialHeight);
    const lastHeightRef = useRef<number | undefined>(undefined);

    const reportHeight = useCallback(
        (height: number) => {
            if (Number.isFinite(height) && height !== lastHeightRef.current) {
                lastHeightRef.current = height;
                contentInsetEndAdjustment.value = height;
            }
        },
        [contentInsetEndAdjustment],
    );

    useLayoutEffect(() => {
        // measure is synchronous in new architecture
        composerRef.current?.measure((_x, _y, _width, height) => {
            reportHeight(height);
        });
    }, [composerRef, reportHeight]);

    const onComposerLayout = useCallback(
        (event: LayoutChangeEvent) => {
            reportHeight(event.nativeEvent.layout.height);
        },
        [reportHeight],
    );

    return { contentInsetEndAdjustment, onComposerLayout };
}

// dismiss() waits for a keyboardDidHide that may never arrive; Android can take ~1.8 s under load.
const DISMISS_TIMEOUT_MS = 2000;

// Settles once, never rejects, and leaves no timer behind.
function dismissKeyboard() {
    let timer: ReturnType<typeof setTimeout> | number | undefined;
    const timeout = new Promise<void>((resolve) => {
        timer = setTimeout(resolve, DISMISS_TIMEOUT_MS);
    });
    return Promise.race([KeyboardController.dismiss(), timeout])
        .catch(() => {})
        .finally(() => clearTimeout(timer));
}

// Distinguish end-scroll ownership from a caller freezing layout for another reason.
const endScrollFreezes = new WeakMap<SharedValue<boolean>, SharedValue<false | "animated" | "immediate">>();
const keyboardCloses = new WeakMap<SharedValue<boolean>, { prepare: () => boolean; restore: () => void }>();
function getEndScrollFreeze(freeze: SharedValue<boolean>) {
    let owned = endScrollFreezes.get(freeze);
    if (!owned) {
        owned = makeMutable<false | "animated" | "immediate">(false);
        endScrollFreezes.set(freeze, owned);
    }
    return owned;
}

// Keyboard handlers read freeze through derived values, which update after this UI job.
function setFreeze(freeze: SharedValue<boolean>, value: boolean, onSet?: () => void, animated = false) {
    const owned = getEndScrollFreeze(freeze);
    runOnUI(() => {
        "worklet";
        owned.value = value ? (animated ? "animated" : "immediate") : false;
        freeze.value = value;
        if (onSet) runOnJS(onSet)();
    })();
}

export function useKeyboardScrollToEnd({ freeze: freezeProp, listRef }: UseKeyboardScrollToEndOptions) {
    const internalFreeze = useSharedValue(false);
    const freeze = freezeProp ?? internalFreeze;
    const latestRequest = useRef(0);
    const closing = useRef<Promise<unknown>>(undefined);
    // The prepared closed range stays owned until freeze releases, whatever later sends animate.
    const preparedClose = useRef(false);

    const scrollMessageToEnd = useCallback(
        async ({ animated, closeKeyboard }: ScrollMessageToEndOptions) => {
            const list = listRef.current;
            if (!list) return;
            // Set the request's range before its synchronous native dispatch, without end-follow.
            if (closeKeyboard && keyboardCloses.get(freeze)?.prepare()) preparedClose.current = true;
            const scrollPromise = list.scrollToEnd({ animated });
            const request = ++latestRequest.current;

            const frozen = new Promise<void>((resolve) => setFreeze(freeze, true, resolve, preparedClose.current));
            if (closeKeyboard && !closing.current) {
                // Close only once keyboard handlers see the freeze, so the controller does not undo the lift.
                // A send during that close joins it instead of dismissing again.
                closing.current = frozen.then(dismissKeyboard).finally(() => {
                    closing.current = undefined;
                });
            }

            // A newer request releases freeze only after any earlier close settles.
            await Promise.all([scrollPromise, closing.current]).finally(() => {
                if (request === latestRequest.current) {
                    preparedClose.current = false;
                    setFreeze(freeze, false, keyboardCloses.get(freeze)?.restore);
                }
            });
        },
        [freeze, listRef],
    );

    return {
        freeze,
        scrollMessageToEnd,
    };
}

// biome-ignore lint/nursery/noShadow: const function name shadowing is intentional
export const KeyboardAwareLegendList = typedForwardRef(function KeyboardAwareLegendList<ItemT>(
    props: KeyboardAwareLegendListProps<ItemT>,
    forwardedRef: ForwardedRef<LegendListRef>,
) {
    const {
        anchoredEndSpace,
        applyWorkaroundForContentInsetHitTestBug,
        contentInsetEndAdjustment,
        freeze,
        keyboardLiftBehavior,
        keyboardOffset,
        refScrollView,
        ...rest
    } = props;

    const refLegendList = useRef<KeyboardViewabilityListRef | null>(null);
    const combinedRef = useCombinedRef(forwardedRef, refLegendList);
    // The forwarded static contentInset, read at report time. Keep it flowing
    // through rest as well.
    const staticContentInsetRef = useRef(rest.contentInset);
    staticContentInsetRef.current = rest.contentInset;
    const blankSpace = useSharedValue<number>(0);
    const scrollRef = useAnimatedRef<React.ElementRef<typeof Reanimated.ScrollView>>();
    const combinedScrollRef = useCombinedRef<React.ElementRef<typeof Reanimated.ScrollView>>(scrollRef, refScrollView);
    const scrollOffset = useScrollViewOffset(scrollRef);
    const dimensions = useSharedValue({ content: 0, viewport: 0 });
    const frozenClose = useSharedValue(false);
    const closeOffset = useSharedValue(0);
    const endScrollFreeze = typeof freeze === "object" ? getEndScrollFreeze(freeze) : undefined;
    const reportedInsets = useRef<KeyboardChatScrollViewContentInsets | undefined>(undefined);
    const initialKeyboardHeight = KeyboardController.state().height;
    const keyboard = useSharedValue({ height: initialKeyboardHeight, progress: initialKeyboardHeight > 0 ? 1 : 0 });
    // The height the keyboard is moving to; while it is open the controller owns the lift.
    const keyboardTarget = useSharedValue(initialKeyboardHeight);
    // Worklets deep-copy captured objects; keep only the primitive in the reaction scope.
    const isHorizontal = !!rest.horizontal;
    const reportViewabilityInset = useCallback((inset: number) => {
        refLegendList.current?.reportViewabilityInsetEndInternal?.(inset);
    }, []);
    const onKeyboardMove = (event: { height: number; progress: number }) => {
        "worklet";
        keyboard.value = { height: event.height, progress: event.progress };
    };
    // onStart carries the target; movement events describe actual occlusion.
    useKeyboardHandler(
        {
            onEnd: onKeyboardMove,
            onInteractive: onKeyboardMove,
            onMove: onKeyboardMove,
            onStart: (event) => {
                "worklet";
                keyboardTarget.value = event.height;
                if (event.height === 0 && !frozenClose.value) closeOffset.value = scrollOffset.value;
                frozenClose.value = event.height === 0 && !!endScrollFreeze?.value;
            },
        },
        [endScrollFreeze],
    );
    useAnimatedReaction(
        // Blank space extends the scroll range but does not obscure content.
        () =>
            isHorizontal
                ? 0
                : Math.max(0, keyboard.value.height - (keyboardOffset ?? 0) * keyboard.value.progress) +
                  Math.max(0, contentInsetEndAdjustment?.value ?? 0),
        (current, previous) => {
            if (current !== previous) {
                runOnJS(reportViewabilityInset)(current);
            }
        },
        [contentInsetEndAdjustment, isHorizontal, keyboard, keyboardOffset, reportViewabilityInset],
    );

    useEffect(() => {
        if (!anchoredEndSpace) {
            blankSpace.value = 0;
        }
    }, [anchoredEndSpace, blankSpace]);

    const anchoredEndSpaceWithBlankSpace = useMemo(() => {
        if (!anchoredEndSpace) {
            return undefined;
        }

        return {
            ...anchoredEndSpace,
            onSizeChanged: (size: number) => {
                // runOnUI keeps this ahead of the content extent's release, which ReanimatedContentExtent
                // queues later from a layout effect; a `.value` write is dispatched on its own.
                runOnUI((next: number) => {
                    "worklet";
                    blankSpace.value = next;
                })(size);
                anchoredEndSpace.onSizeChanged?.(size);
            },
        };
    }, [anchoredEndSpace, blankSpace]);

    const staticBottomInset = Platform.OS === "ios" ? (rest.contentInset?.bottom ?? 0) : 0;
    const getEndInset = useCallback(
        (keyboardInset = 0) => {
            "worklet";
            const padding = keyboardInset + (contentInsetEndAdjustment?.value ?? 0);
            return staticBottomInset + Math.min(dimensions.value.viewport, Math.max(blankSpace.value, padding));
        },
        [blankSpace, contentInsetEndAdjustment, dimensions, staticBottomInset],
    );
    const onContentInsetChange = useCallback(
        (insets: KeyboardChatScrollViewContentInsets) => {
            // Android applies only dynamic padding; the report also includes the iOS-only static prop.
            const staticInset = staticContentInsetRef.current;
            if (Platform.OS !== "ios" && staticInset) {
                insets = {
                    bottom: Math.max(0, (insets.bottom ?? 0) - (staticInset.bottom ?? 0)),
                    left: Math.max(0, (insets.left ?? 0) - (staticInset.left ?? 0)),
                    right: Math.max(0, (insets.right ?? 0) - (staticInset.right ?? 0)),
                    top: Math.max(0, (insets.top ?? 0) - (staticInset.top ?? 0)),
                };
            }
            reportedInsets.current = insets;
            const list = refLegendList.current;
            // Frozen controller padding still includes the keyboard when the composer changes.
            if (endScrollFreeze?.value === "animated") {
                list?.reportContentInsetForScrollInternal?.({ ...insets, bottom: getEndInset() });
            } else if (
                (keyboardTarget.value > 0 || keyboard.value.height > 0) &&
                list?.reportContentInsetForScrollInternal
            ) {
                // The controller owns keyboard movement in both directions; end-follow would fight it.
                list.reportContentInsetForScrollInternal(insets);
            } else {
                list?.reportContentInset(insets);
            }
        },
        [endScrollFreeze, getEndInset, keyboard, keyboardTarget],
    );
    const reportClosingInset = useCallback((bottom: number) => {
        refLegendList.current?.reportContentInset({ ...reportedInsets.current, bottom });
    }, []);
    useLayoutEffect(() => {
        if (typeof freeze !== "object") return;
        keyboardCloses.set(freeze, {
            prepare: () => {
                const report = refLegendList.current?.reportContentInsetForScrollInternal;
                if (isHorizontal || !dimensions.value.viewport || keyboard.value.height === 0 || !report) return false;
                report({ ...reportedInsets.current, bottom: getEndInset() });
                return true;
            },
            restore: () => {
                if (keyboard.value.height > 0 && reportedInsets.current) {
                    refLegendList.current?.reportContentInset(reportedInsets.current);
                }
            },
        });
        return () => {
            keyboardCloses.delete(freeze);
        };
    }, [dimensions, freeze, getEndInset, isHorizontal, keyboard]);
    useAnimatedReaction(
        () =>
            frozenClose.value && endScrollFreeze?.value === "immediate" && typeof freeze === "object" && freeze.value
                ? { height: keyboard.value.height, scroll: scrollOffset.value }
                : null,
        (current, previous) => {
            if (!current) {
                frozenClose.value = false;
                return;
            }
            if (isHorizontal || !dimensions.value.viewport) return;
            closeOffset.value = Math.min(closeOffset.value, current.scroll);
            const keyboardInset = Math.max(0, current.height - (keyboardOffset ?? 0) * keyboard.value.progress);
            const contentEnd = dimensions.value.content - dimensions.value.viewport;
            const keyboardEndInset = getEndInset(keyboardInset);
            // Keep a monotonic ceiling across overlapping requests (#557).
            const inset = Math.max(getEndInset(), Math.min(keyboardEndInset, closeOffset.value - contentEnd));
            // Report at keyboard zero so end-follow cannot chase intermediate frames.
            if (current.height === 0 && previous?.height !== 0) runOnJS(reportClosingInset)(getEndInset());
            const end = Math.max(0, contentEnd + inset);
            if (current.scroll > end) scrollTo(scrollRef, 0, end, false);
        },
        [freeze, getEndInset, isHorizontal, keyboardOffset, reportClosingInset],
    );

    const memoList = useCallback(
        (scrollProps: ScrollViewProps) => {
            return (
                <KeyboardChatScrollView
                    {...scrollProps}
                    applyWorkaroundForContentInsetHitTestBug={applyWorkaroundForContentInsetHitTestBug}
                    blankSpace={blankSpace}
                    extraContentPadding={contentInsetEndAdjustment}
                    freeze={freeze}
                    keyboardLiftBehavior={keyboardLiftBehavior}
                    offset={keyboardOffset}
                    onContentInsetChange={onContentInsetChange}
                    onContentSizeChange={(width, height) => {
                        dimensions.value = { ...dimensions.value, content: height };
                        scrollProps.onContentSizeChange?.(width, height);
                    }}
                    onLayout={(event) => {
                        dimensions.value = { ...dimensions.value, viewport: event.nativeEvent.layout.height };
                        scrollProps.onLayout?.(event);
                    }}
                />
            );
        },
        [
            applyWorkaroundForContentInsetHitTestBug,
            blankSpace,
            contentInsetEndAdjustment,
            dimensions,
            freeze,
            keyboardLiftBehavior,
            keyboardOffset,
            onContentInsetChange,
        ],
    );

    const AnimatedLegendListInternal = AnimatedLegendList as unknown as React.ComponentType<
        AnimatedLegendListProps<ItemT> & {
            anchoredEndSpace?: AnchoredEndSpaceConfig;
            anchoredEndSpaceOwnerInternal?: "list" | "scroll";
            contentExtentComponentInternal?: React.ComponentType<ContentExtentProps>;
            ref?: ForwardedRef<LegendListRef>;
        }
    >;

    return (
        <AnimatedLegendListInternal
            anchoredEndSpace={anchoredEndSpaceWithBlankSpace}
            anchoredEndSpaceOwnerInternal="scroll"
            contentExtentComponentInternal={ReanimatedContentExtent}
            ref={combinedRef}
            refScrollView={combinedScrollRef}
            renderScrollComponent={memoList}
            {...rest}
        />
    );
});
