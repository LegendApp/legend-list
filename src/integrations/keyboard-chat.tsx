// biome-ignore lint/style/useImportType: Leaving this out makes it crash in some environments
import * as React from "react";
import { type ForwardedRef, useCallback, useEffect, useMemo, useRef } from "react";
import type { ScrollViewProps } from "react-native";
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

type KeyboardChatScrollViewPropsUnique = Omit<
    KeyboardChatScrollViewProps,
    keyof ScrollViewProps | "inverted" | "ScrollViewComponent" | "blankSpace" | "onContentInsetChange"
>;

type KeyboardChatLegendListProps<ItemT> = Omit<
    AnimatedLegendListProps<ItemT>,
    "anchoredEndSpace" | "renderScrollComponent"
> &
    KeyboardChatScrollViewPropsUnique & {
        anchoredEndSpace?: AnchoredEndSpaceConfig;
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

export function useKeyboardScrollToEnd({ freeze: freezeProp, listRef }: UseKeyboardScrollToEndOptions) {
    const internalFreeze = useSharedValue(false);
    const freeze = freezeProp ?? internalFreeze;

    const scrollMessageToEnd = useCallback(
        async ({ animated, closeKeyboard }: ScrollMessageToEndOptions) => {
            const listRefCurrent = listRef.current;
            if (listRefCurrent) {
                freeze.set(true);

                const dismissPromise = closeKeyboard && KeyboardController.dismiss();
                const scrollPromise = listRefCurrent.scrollToEnd({ animated });

                await Promise.all([scrollPromise, dismissPromise]);

                freeze.set(false);
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
export const KeyboardChatLegendList = typedForwardRef(function KeyboardChatLegendList<ItemT>(
    props: KeyboardChatLegendListProps<ItemT>,
    forwardedRef: ForwardedRef<LegendListRef>,
) {
    const {
        anchoredEndSpace,
        applyWorkaroundForContentInsetHitTestBug,
        extraContentPadding,
        freeze,
        keyboardLiftBehavior,
        offset,
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
                    extraContentPadding={extraContentPadding}
                    // freeze={freeze}
                    keyboardLiftBehavior={keyboardLiftBehavior}
                    offset={offset}
                    onContentInsetChange={onContentInsetChange}
                />
            );
        },
        [
            applyWorkaroundForContentInsetHitTestBug,
            blankSpace,
            extraContentPadding,
            freeze,
            keyboardLiftBehavior,
            onContentInsetChange,
            offset,
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
