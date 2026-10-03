// biome-ignore lint/style/useImportType: Leaving this out makes it crash in some environments
import * as React from "react";
import { type ForwardedRef, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { type LayoutChangeEvent, Platform, type ScrollViewProps, type View } from "react-native";
import {
    KeyboardChatScrollView,
    type KeyboardChatScrollViewProps,
    KeyboardController,
} from "react-native-keyboard-controller";
import { executeOnUIRuntimeSync, type SharedValue, useSharedValue } from "react-native-reanimated";

import type { AnchoredEndSpaceConfig } from "@legendapp/list/react";
import type { LegendListRef } from "@legendapp/list/react-native";
import { internal } from "@legendapp/list/react-native";
import { AnimatedLegendList, type AnimatedLegendListProps } from "@legendapp/list/reanimated";

const { typedForwardRef, useCombinedRef } = internal;

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

function setFreeze(freeze: SharedValue<boolean>, value: boolean) {
    if (Platform.OS === "web") {
        freeze.set(value);
        return;
    }

    // Write on the UI runtime synchronously, so the keyboard handlers see the value
    // before a keyboard close started in the same task begins.
    executeOnUIRuntimeSync((next: boolean) => {
        "worklet";
        freeze.value = next;
    })(value);
}

interface FreezeOwner {
    activeCalls: number;
    freeze: SharedValue<boolean>;
    isRetired: boolean;
}

export function useKeyboardScrollToEnd({ freeze: freezeProp, listRef }: UseKeyboardScrollToEndOptions) {
    const internalFreeze = useSharedValue(false);
    const freeze = freezeProp ?? internalFreeze;
    // Callers often scroll from their own layout effects, which can run before this
    // hook's effects, so a call before the first effect still counts as mounted.
    const isMountedRef = useRef(true);
    // Calls belong to the effect lifetime they start in. A cleanup (unmount, effect
    // replay, or a new `freeze`) retires its owner, so an older call never releases
    // a newer lifetime's freeze.
    const ownerRef = useRef<FreezeOwner | undefined>(undefined);

    useLayoutEffect(() => {
        isMountedRef.current = true;

        return () => {
            isMountedRef.current = false;
        };
    }, []);

    useLayoutEffect(() => {
        if (!ownerRef.current || ownerRef.current.freeze !== freeze) {
            ownerRef.current = { activeCalls: 0, freeze, isRetired: false };
        }
        const owner = ownerRef.current;

        return () => {
            owner.isRetired = true;
            if (ownerRef.current === owner) {
                ownerRef.current = undefined;
            }
            if (owner.activeCalls > 0) {
                owner.activeCalls = 0;
                setFreeze(owner.freeze, false);
            }
        };
    }, [freeze]);

    const scrollMessageToEnd = useCallback(
        async ({ animated, closeKeyboard }: ScrollMessageToEndOptions) => {
            const listRefCurrent = listRef.current;
            if (!listRefCurrent || !isMountedRef.current) {
                return;
            }

            if (!ownerRef.current || ownerRef.current.freeze !== freeze) {
                ownerRef.current = { activeCalls: 0, freeze, isRetired: false };
            }
            const owner = ownerRef.current;

            // Overlapping calls share the freeze; only the last one to settle releases it.
            owner.activeCalls += 1;
            if (owner.activeCalls === 1) {
                setFreeze(owner.freeze, true);
            }

            try {
                const scrollPromise = listRefCurrent.scrollToEnd({ animated });
                const dismissPromise = closeKeyboard && KeyboardController.dismiss();

                await Promise.all([scrollPromise, dismissPromise]);
            } finally {
                if (!owner.isRetired) {
                    owner.activeCalls -= 1;
                    if (owner.activeCalls === 0) {
                        setFreeze(owner.freeze, false);
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
            anchoredEndSpaceOwnerInternal?: "list" | "scroll";
            ref?: ForwardedRef<LegendListRef>;
        }
    >;

    return (
        <AnimatedLegendListInternal
            anchoredEndSpace={anchoredEndSpaceWithBlankSpace}
            anchoredEndSpaceOwnerInternal="scroll"
            ref={combinedRef}
            renderScrollComponent={memoList}
            {...rest}
        />
    );
});
