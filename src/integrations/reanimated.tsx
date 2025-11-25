import * as React from "react";
import { type ComponentProps, memo, useCallback } from "react";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import type { SharedValue } from "react-native-reanimated";
import Animated from "react-native-reanimated";

import {
    LegendList,
    type LegendListProps,
    type LegendListPropsBase,
    type LegendListRef,
    type TypedMemo,
} from "@legendapp/list";
import { useCombinedRef } from "@/hooks/useCombinedRef";
import { isReanimatedScroll } from "@/utils/helpers";

type KeysToOmit =
    | "getEstimatedItemSize"
    | "getFixedItemSize"
    | "getItemType"
    | "keyExtractor"
    | "animatedProps"
    | "renderItem"
    | "onItemSizeChanged"
    | "itemsAreEqual"
    | "ItemSeparatorComponent"
    | "onScroll";

type PropsBase<ItemT> = LegendListPropsBase<ItemT, ComponentProps<typeof Animated.ScrollView>>;

export interface AnimatedLegendListPropsBase<ItemT> extends Omit<PropsBase<ItemT>, KeysToOmit> {
    refScrollView?: React.Ref<Animated.ScrollView>;
    onScroll?:
        | ((event: NativeSyntheticEvent<NativeScrollEvent>) => void)
        | SharedValue<((event: NativeSyntheticEvent<NativeScrollEvent>) => void) | undefined>;
}

type OtherAnimatedLegendListProps<ItemT> = Pick<PropsBase<ItemT>, KeysToOmit>;

const typedMemo = memo as TypedMemo;

// A component that receives a ref for the Animated.ScrollView and passes it to the LegendList
const LegendListForwardedRef = typedMemo(
    React.forwardRef(function LegendListForwardedRef<ItemT>(
        props: LegendListProps<ItemT> & {
            refLegendList: (r: LegendListRef | null) => void;
            onScroll?:
                | ((event: NativeSyntheticEvent<NativeScrollEvent>) => void)
                | SharedValue<((event: NativeSyntheticEvent<NativeScrollEvent>) => void) | undefined>;
        },
        ref: React.Ref<Animated.ScrollView>,
    ) {
        const { refLegendList, onScroll, ...rest } = props;

        const refFn = useCallback(
            (r: LegendListRef) => {
                refLegendList(r);
            },
            [refLegendList],
        );

        const scrollHandler = useCallback(
            (event: NativeSyntheticEvent<NativeScrollEvent>) => {
                if (onScroll) {
                    if (isReanimatedScroll(onScroll)) {
                        onScroll.value?.(event);
                    } else {
                        onScroll(event);
                    }
                }
            },
            [onScroll],
        );

        return <LegendList onScroll={scrollHandler} ref={refFn} refScrollView={ref} {...rest} />;
    }),
);

const AnimatedLegendListComponent = Animated.createAnimatedComponent(LegendListForwardedRef);

type AnimatedLegendListProps<ItemT> = Omit<AnimatedLegendListPropsBase<ItemT>, "refLegendList" | "ref"> &
    OtherAnimatedLegendListProps<ItemT>;

type AnimatedLegendListDefinition = <ItemT>(
    props: AnimatedLegendListProps<ItemT> & { ref?: React.Ref<LegendListRef> },
) => React.ReactElement | null;

// A component that has the shape of LegendList which passes the ref down as refLegendList
const AnimatedLegendList = typedMemo(
    React.forwardRef(function AnimatedLegendList<ItemT>(
        props: AnimatedLegendListProps<ItemT>,
        ref: React.Ref<LegendListRef>,
    ) {
        const { refScrollView, ...rest } = props as AnimatedLegendListPropsBase<ItemT>;

        const refLegendList = React.useRef<LegendListRef | null>(null);

        const combinedRef = useCombinedRef(refLegendList, ref);

        return <AnimatedLegendListComponent ref={refScrollView} refLegendList={combinedRef} {...(rest as any)} />;
    }),
) as AnimatedLegendListDefinition;

export { AnimatedLegendList, type AnimatedLegendListProps };
