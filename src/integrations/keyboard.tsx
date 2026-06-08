// biome-ignore lint/style/useImportType: Leaving this out makes it crash in some environments
import * as React from "react";
import { type ForwardedRef, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { Keyboard, type LayoutChangeEvent, Platform, type ScrollViewProps, type View } from "react-native";
import {
    KeyboardChatScrollView,
    type KeyboardChatScrollViewProps,
    KeyboardController,
} from "react-native-keyboard-controller";
import { type SharedValue, useSharedValue } from "react-native-reanimated";

import type { AnchoredEndSpaceConfig } from "@legendapp/list/react";
import type { LegendListRef } from "@legendapp/list/react-native";
import { internal } from "@legendapp/list/react-native";
import { AnimatedLegendList, type AnimatedLegendListProps } from "@legendapp/list/reanimated";

const { typedForwardRef, useCombinedRef } = internal;

const ANDROID_KEYBOARD_HIDE_FALLBACK_MS = 300;
const ANDROID_KEYBOARD_LAYOUT_SETTLE_MS = 60;

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

type ScrollMessageToEndOptions = {
    animated: boolean;
    closeKeyboard: boolean;
};

type KeyboardScrollToEndListRef = {
    current: {
        scrollToEnd(params?: { animated?: boolean }): Promise<void>;
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

function wait(ms: number) {
    return new Promise<void>((resolve) => {
        setTimeout(resolve, ms);
    });
}
/**
 * Waits for Android to report that the keyboard is hidden, with a timeout fallback for
 * devices or controller paths that complete dismissal without emitting keyboardDidHide.
 */
function waitForKeyboardDidHide() {
    return new Promise<void>((resolve) => {
        let didResolve = false;

        const finish = () => {
            if (didResolve) {
                return;
            }

            didResolve = true;
            clearTimeout(timeoutId);
            subscription.remove();
            resolve();
        };

        const subscription = Keyboard.addListener("keyboardDidHide", finish);
        const timeoutId = setTimeout(finish, ANDROID_KEYBOARD_HIDE_FALLBACK_MS);
    });
}

export function useKeyboardChatComposerInset(
    listRef: KeyboardChatComposerInsetListRef,
    composerRef: KeyboardChatComposerRef,
    initialHeight = 0,
) {
    const contentInsetEndAdjustment = useSharedValue(initialHeight);
    const lastHeightRef = useRef<number | undefined>(undefined);

    const reportHeight = useCallback(
        (height: number) => {
            if (Number.isFinite(height) && height !== lastHeightRef.current) {
                lastHeightRef.current = height;
                contentInsetEndAdjustment.value = height;
                listRef.current?.reportContentInset({ bottom: height });
            }
        },
        [contentInsetEndAdjustment, listRef],
    );

    useLayoutEffect(() => {
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

export function useKeyboardScrollToEnd({ freeze: freezeProp, listRef }: UseKeyboardScrollToEndOptions) {
    const internalFreeze = useSharedValue(false);
    const freeze = freezeProp ?? internalFreeze;
    const scrollSequenceRef = useRef(0);

    const scrollMessageToEnd = useCallback(
        async ({ animated, closeKeyboard }: ScrollMessageToEndOptions) => {
            const listRefCurrent = listRef.current;
            if (listRefCurrent) {
                const scrollSequence = scrollSequenceRef.current + 1;

                scrollSequenceRef.current = scrollSequence;
                freeze.set(true);

                try {
                    if (Platform.OS === "android" && closeKeyboard) {
                        // Android can resize the list viewport after dismiss starts, so the scroll target
                        // is only computed once the keyboard hide event and a short layout settle have passed.
                        const keyboardDidHidePromise = waitForKeyboardDidHide();
                        const dismissPromise = KeyboardController.dismiss();

                        await Promise.all([dismissPromise, keyboardDidHidePromise]);
                        await wait(ANDROID_KEYBOARD_LAYOUT_SETTLE_MS);

                        // A newer send supersedes this sequence; avoid completing an old scroll over it.
                        if (scrollSequenceRef.current === scrollSequence) {
                            await listRef.current?.scrollToEnd({ animated });
                        }
                        return;
                    }

                    const dismissPromise = closeKeyboard && KeyboardController.dismiss();
                    const scrollPromise = listRefCurrent.scrollToEnd({ animated });

                    await Promise.all([scrollPromise, dismissPromise]);
                } finally {
                    if (scrollSequenceRef.current === scrollSequence) {
                        freeze.set(false);
                    }
                }
            }
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
        ...rest
    } = props;

    const refLegendList = useRef<LegendListRef | null>(null);
    const combinedRef = useCombinedRef(forwardedRef, refLegendList);
    const blankSpace = useSharedValue<number>(0);

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
            includeInEndInset: true,
            onSizeChanged: (size: number) => {
                blankSpace.value = size;
                anchoredEndSpace.onSizeChanged?.(size);
            },
        };
    }, [anchoredEndSpace, blankSpace]);

    const onContentInsetChange = useCallback((insets: KeyboardChatScrollViewContentInsets) => {
        refLegendList.current?.reportContentInset(insets);
    }, []);

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
                />
            );
        },
        [
            applyWorkaroundForContentInsetHitTestBug,
            blankSpace,
            contentInsetEndAdjustment,
            freeze,
            keyboardLiftBehavior,
            keyboardOffset,
            onContentInsetChange,
        ],
    );

    const AnimatedLegendListInternal = AnimatedLegendList as unknown as React.ComponentType<
        AnimatedLegendListProps<ItemT> & {
            anchoredEndSpace?: AnchoredEndSpaceConfig;
            ref?: ForwardedRef<LegendListRef>;
        }
    >;

    return (
        <AnimatedLegendListInternal
            anchoredEndSpace={anchoredEndSpaceWithBlankSpace}
            ref={combinedRef}
            renderScrollComponent={memoList}
            {...rest}
        />
    );
});
