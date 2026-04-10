// biome-ignore lint/correctness/noUnusedImports: Required for JSX runtime in some environments
import * as React from "react";
import { type ForwardedRef, useCallback, useEffect, useRef } from "react";
import type { ScrollViewProps } from "react-native";
import { KeyboardChatScrollView, type KeyboardChatScrollViewProps } from "react-native-keyboard-controller";
import { useSharedValue } from "react-native-reanimated";

import { internal, type LegendListRef, typedForwardRef } from "@legendapp/list/react-native";
import { AnimatedLegendList, type AnimatedLegendListProps } from "@legendapp/list/reanimated";

const { useCombinedRef } = internal;

type KeyboardChatScrollViewPropsUnique = Omit<
    KeyboardChatScrollViewProps,
    keyof ScrollViewProps | "inverted" | "ScrollViewComponent"
>;

type KeyboardChatLegendListProps<ItemT> = Omit<AnimatedLegendListProps<ItemT>, "renderScrollComponent"> &
    KeyboardChatScrollViewPropsUnique & {
        spaceToTopIndex?: number;
    };

// biome-ignore lint/nursery/noShadow: const function name shadowing is intentional
export const KeyboardChatLegendList = typedForwardRef(function KeyboardChatLegendList<ItemT>(
    props: KeyboardChatLegendListProps<ItemT>,
    forwardedRef: ForwardedRef<LegendListRef>,
) {
    const {
        spaceToTopIndex,
        onItemSizeChanged: onItemSizeChangedProp,
        onMetricsChange: onMetricsChangeProp,
        extraContentPadding,
        ...rest
    } = props;

    const refLegendList = useRef<LegendListRef | null>(null);
    const combinedRef = useCombinedRef(forwardedRef, refLegendList);

    const blankSpace = useSharedValue<number>(0);

    const calculateTopItemInset = useCallback(() => {
        if (spaceToTopIndex === undefined || spaceToTopIndex < 0) {
            blankSpace.value = 0;
            refLegendList.current?.reportContentInset(null);

            return;
        }

        const state = refLegendList.current?.getState();

        if (!state || spaceToTopIndex >= state.data.length || state.scrollLength <= 0) {
            return;
        }

        let contentBelowTopItem = 0;

        for (let i = spaceToTopIndex; i < state.data.length; i++) {
            const size = state.sizeAtIndex(i);

            if (size !== null && size > 0) {
                contentBelowTopItem += size;
            }
        }

        const calculatedInset = Math.max(0, state.scrollLength - contentBelowTopItem);

        blankSpace.value = calculatedInset;
        refLegendList.current?.reportContentInset({ bottom: calculatedInset });
    }, [spaceToTopIndex]);

    const handleMetricsChange = useCallback(
        (metrics: Parameters<NonNullable<AnimatedLegendListProps<ItemT>["onMetricsChange"]>>[0]) => {
            calculateTopItemInset();
            onMetricsChangeProp?.(metrics);
        },
        [calculateTopItemInset, onMetricsChangeProp],
    );

    const handleItemSizeChange = useCallback(
        (info: { size: number; previous: number; index: number; itemKey: string; itemData: ItemT }) => {
            if (spaceToTopIndex !== undefined && info.index >= spaceToTopIndex) {
                calculateTopItemInset();
            }
            onItemSizeChangedProp?.(info);
        },
        [spaceToTopIndex, calculateTopItemInset, onItemSizeChangedProp],
    );

    useEffect(() => {
        calculateTopItemInset();
    }, [spaceToTopIndex, calculateTopItemInset]);

    const memoList = useCallback(
        (scrollProps: ScrollViewProps) => {
            return (
                <KeyboardChatScrollView
                    {...scrollProps}
                    applyWorkaroundForContentInsetHitTestBug
                    blankSpace={blankSpace}
                    extraContentPadding={extraContentPadding}
                />
            );
        },
        [blankSpace, extraContentPadding],
    );

    return (
        <AnimatedLegendList
            onItemSizeChanged={handleItemSizeChange}
            onMetricsChange={handleMetricsChange}
            ref={combinedRef}
            renderScrollComponent={memoList}
            {...rest}
        />
    );
});
