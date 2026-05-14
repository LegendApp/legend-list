// biome-ignore lint/correctness/noUnusedImports: Leaving this out makes it crash in some environments
import * as React from "react";
import { type ForwardedRef, useCallback, useRef } from "react";
import type { ScrollViewProps } from "react-native";
import { KeyboardChatScrollView, type KeyboardChatScrollViewProps } from "react-native-keyboard-controller";
import type { SharedValue } from "react-native-reanimated";

export { useKeyboardScrollToEnd } from "@legendapp/list/keyboard-chat";

import { internal, type LegendListRef } from "@legendapp/list/react-native";

const { typedForwardRef, useCombinedRef } = internal;

import { AnimatedLegendList, type AnimatedLegendListProps } from "@legendapp/list/reanimated";

type KeyboardChatScrollViewPropsUnique = Omit<
    KeyboardChatScrollViewProps,
    keyof ScrollViewProps | "inverted" | "ScrollViewComponent" | "extraContentPadding" | "onContentInsetChange"
>;

type KeyboardAvoidingLegendListProps<ItemT> = Omit<
    AnimatedLegendListProps<ItemT>,
    "contentInsetEndAdjustment" | "renderScrollComponent"
> &
    KeyboardChatScrollViewPropsUnique & {
        contentInsetEndAdjustment?: SharedValue<number>;
    };

type KeyboardChatScrollViewContentInsets = Parameters<
    NonNullable<KeyboardChatScrollViewProps["onContentInsetChange"]>
>[0];

// biome-ignore lint/nursery/noShadow: const function name shadowing is intentional
export const KeyboardAvoidingLegendList = typedForwardRef(function KeyboardAvoidingLegendList<ItemT>(
    props: KeyboardAvoidingLegendListProps<ItemT>,
    forwardedRef: ForwardedRef<LegendListRef>,
) {
    const { contentInsetEndAdjustment, ...rest } = props;

    const refLegendList = useRef<LegendListRef | null>(null);
    const combinedRef = useCombinedRef(forwardedRef, refLegendList);

    const onContentInsetChange = useCallback((insets: KeyboardChatScrollViewContentInsets) => {
        refLegendList.current?.reportContentInset(insets);
    }, []);

    const memoList = useCallback(
        (listProps: ScrollViewProps) => (
            <KeyboardChatScrollView
                {...listProps}
                extraContentPadding={contentInsetEndAdjustment}
                onContentInsetChange={onContentInsetChange}
            />
        ),
        [contentInsetEndAdjustment, onContentInsetChange],
    );

    return <AnimatedLegendList ref={combinedRef} renderScrollComponent={memoList} {...rest} />;
});
