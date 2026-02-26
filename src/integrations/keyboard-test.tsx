// biome-ignore lint/style/useImportType: Leaving this out makes it crash in some environments
import * as React from "react";
import { type ForwardedRef, forwardRef, useCallback } from "react";
import type { ScrollViewProps } from "react-native";
import { KeyboardChatScrollView, type KeyboardChatScrollViewProps } from "react-native-keyboard-controller";

import { LegendList as LegendListBase, type LegendListProps, type LegendListRef } from "@legendapp/list/react-native";

// biome-ignore lint/complexity/noBannedTypes: This is a workaround for the fact that forwardRef is not typed
type TypedForwardRef = <T, P = {}>(
    render: (props: P, ref: React.Ref<T>) => React.ReactNode,
) => (props: P & React.RefAttributes<T>) => React.ReactNode;

const typedForwardRef = forwardRef as TypedForwardRef;

type KeyboardChatScrollViewPropsUnique = Omit<
    KeyboardChatScrollViewProps,
    keyof ScrollViewProps | "inverted" | "ScrollViewComponent"
>;

// biome-ignore lint/nursery/noShadow: const function name shadowing is intentional
export const KeyboardAvoidingLegendList = typedForwardRef(function KeyboardAvoidingLegendList<ItemT>(
    props: LegendListProps<ItemT> & KeyboardChatScrollViewPropsUnique,
    forwardedRef: ForwardedRef<LegendListRef>,
) {
    const memoList = useCallback((listProps: ScrollViewProps) => <KeyboardChatScrollView {...listProps} />, []);

    return <LegendListBase ref={forwardedRef} renderScrollComponent={memoList as any} {...props} />;
});
