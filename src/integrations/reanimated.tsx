import * as React from "react";
import { type ComponentProps, memo, useCallback } from "react";
import Reanimated from "react-native-reanimated";

import {
    LegendList,
    type LegendListProps,
    type LegendListPropsBase,
    type LegendListRef,
    type TypedMemo,
} from "@legendapp/list";
import { useCombinedRef } from "@/hooks/useCombinedRef";

type KeysToOmit =
    | "getEstimatedItemSize"
    | "getFixedItemSize"
    | "getItemType"
    | "keyExtractor"
    | "animatedProps"
    | "renderItem"
    | "onItemSizeChanged"
    | "itemsAreEqual"
    | "ItemSeparatorComponent";

type PropsBase<ItemT> = LegendListPropsBase<ItemT, ComponentProps<typeof Reanimated.ScrollView>>;

export interface AnimatedLegendListPropsBase<ItemT> extends Omit<PropsBase<ItemT>, KeysToOmit> {
    refScrollView?: React.Ref<Reanimated.ScrollView>;
}

type OtherAnimatedLegendListProps<ItemT> = Pick<PropsBase<ItemT>, KeysToOmit>;

const typedMemo = memo as TypedMemo;

// A component that receives a ref for the Animated.ScrollView and passes it to the LegendList
const LegendListForwardedRef = typedMemo(
    // biome-ignore lint/nursery/noShadow: const function name shadowing is intentional
    React.forwardRef(function LegendListForwardedRef<ItemT>(
        props: LegendListProps<ItemT> & { refLegendList: (r: LegendListRef | null) => void },
        ref: React.Ref<Reanimated.ScrollView>,
    ) {
        const { refLegendList, ...rest } = props;

        const refFn = useCallback(
            (r: LegendListRef) => {
                refLegendList(r);
            },
            [refLegendList],
        );

        return <LegendList ref={refFn} refScrollView={ref} {...rest} />;
    }),
);

const AnimatedLegendListComponent = Reanimated.createAnimatedComponent(LegendListForwardedRef);

type AnimatedLegendListProps<ItemT> = Omit<AnimatedLegendListPropsBase<ItemT>, "refLegendList" | "ref"> &
    OtherAnimatedLegendListProps<ItemT>;

type AnimatedLegendListDefinition = <ItemT>(
    props: AnimatedLegendListProps<ItemT> & { ref?: React.Ref<LegendListRef> },
) => React.ReactElement | null;

// A component that has the shape of LegendList which passes the ref down as refLegendList
const AnimatedLegendList = typedMemo(
    // biome-ignore lint/nursery/noShadow: const function name shadowing is intentional
    React.forwardRef(function AnimatedLegendList<ItemT>(
        props: AnimatedLegendListProps<ItemT>,
        ref: React.Ref<LegendListRef>,
    ) {
        const { refScrollView, animatedProps, ...rest } = props as AnimatedLegendListProps<ItemT>;

        const refLegendList = React.useRef<LegendListRef | null>(null);

        const combinedRef = useCombinedRef(refLegendList, ref);

        return (
            <AnimatedLegendListComponent
                animatedProps={animatedProps ?? {}}
                animatedPropsInternal={animatedProps ?? {}}
                ref={refScrollView}
                refLegendList={combinedRef}
                {...(rest as any)}
            />
        );
    }),
) as AnimatedLegendListDefinition;

export { AnimatedLegendList, type AnimatedLegendListProps };
