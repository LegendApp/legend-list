import { LegendList, type LegendListProps, type LegendListPropsBase, type LegendListRef } from "@legendapp/list";
import React, { type ComponentProps } from "react";
import Animated from "react-native-reanimated";

type KeysToOmit = "getEstimatedItemSize" | "keyExtractor" | "animatedProps" | "renderItem";

type PropsBase<ItemT> = LegendListPropsBase<ItemT, ComponentProps<typeof Animated.ScrollView>>;

interface AnimatedLegendListProps<ItemT> extends Omit<PropsBase<ItemT>, KeysToOmit> {
    refScrollView?: React.Ref<Animated.ScrollView>;
}

type OtherAnimatedLegendListProps<ItemT> = Pick<PropsBase<ItemT>, KeysToOmit>;

// A component that receives a ref for the Animated.ScrollView and passes it to the LegendList
const LegendListForwardedRef = React.forwardRef(function LegendListForwardedRef<ItemT>(
    props: LegendListProps<ItemT> & { refLegendList: React.Ref<LegendListRef> },
    ref: React.Ref<Animated.ScrollView>,
) {
    const { refLegendList, ...rest } = props;

    return <LegendList refScrollView={ref} ref={refLegendList} {...rest} />;
});

const AnimatedLegendListComponent = Animated.createAnimatedComponent(LegendListForwardedRef);

// A component that has the shape of LegendList which passes the ref down as refLegendList
const AnimatedLegendList = React.forwardRef(function AnimatedLegendList<ItemT>(
    props: AnimatedLegendListProps<ItemT> & OtherAnimatedLegendListProps<ItemT>,
    ref: React.Ref<LegendListRef>,
) {
    const { refScrollView, ...rest } = props as AnimatedLegendListProps<ItemT>;
    return <AnimatedLegendListComponent refLegendList={ref} ref={refScrollView} {...rest} />;
});

export { AnimatedLegendList };
