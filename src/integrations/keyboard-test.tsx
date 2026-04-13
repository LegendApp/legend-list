// biome-ignore lint/correctness/noUnusedImports: Leaving this out makes it crash in some environments
import * as React from "react";
import { type ForwardedRef, useCallback } from "react";
import type { ScrollViewProps } from "react-native";
import { KeyboardChatScrollView, type KeyboardChatScrollViewProps } from "react-native-keyboard-controller";

import { internal, type LegendListRef } from "@legendapp/list/react-native";

const { typedForwardRef } = internal;
import { AnimatedLegendList, type AnimatedLegendListProps } from "@legendapp/list/reanimated";

type KeyboardChatScrollViewPropsUnique = Omit<
    KeyboardChatScrollViewProps,
    keyof ScrollViewProps | "inverted" | "ScrollViewComponent"
>;

type KeyboardAvoidingLegendListProps<ItemT> = Omit<AnimatedLegendListProps<ItemT>, "renderScrollComponent"> &
    KeyboardChatScrollViewPropsUnique;

// biome-ignore lint/nursery/noShadow: const function name shadowing is intentional
export const KeyboardAvoidingLegendList = typedForwardRef(function KeyboardAvoidingLegendList<ItemT>(
    props: KeyboardAvoidingLegendListProps<ItemT>,
    forwardedRef: ForwardedRef<LegendListRef>,
) {
    const { extraContentPadding, ...rest } = props;

    const memoList = useCallback(
        (listProps: ScrollViewProps) => (
            <KeyboardChatScrollView {...listProps} extraContentPadding={extraContentPadding} />
        ),
        [extraContentPadding],
    );

    return <AnimatedLegendList ref={forwardedRef} renderScrollComponent={memoList} {...rest} />;
});
