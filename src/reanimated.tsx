import { LegendList, type LegendListProps, type LegendListPropsBase, type LegendListRef } from "@legendapp/list";
import React, { useMemo, useRef, type ComponentProps } from "react";
import type { LayoutChangeEvent, StyleProp, ViewStyle } from "react-native";
import Animated from "react-native-reanimated";
import type { ILayoutAnimationBuilder } from "react-native-reanimated";
import { LayoutAnimationConfig } from "react-native-reanimated";
import type { AnimatedStyle } from "react-native-reanimated";
import { useCombinedRef } from "./useCombinedRef";

type KeysToOmit =
    | "getEstimatedItemSize"
    | "keyExtractor"
    | "animatedProps"
    | "renderItem"
    | "onItemSizeChanged"
    | "ItemSeparatorComponent";

type PropsBase<ItemT> = LegendListPropsBase<ItemT, ComponentProps<typeof Animated.ScrollView>>;

export interface AnimatedLegendListPropsBase<ItemT> extends Omit<PropsBase<ItemT>, KeysToOmit> {
    refScrollView?: React.Ref<Animated.ScrollView>;
    itemLayoutAnimation?: ILayoutAnimationBuilder;
    skipEnteringExitingAnimations?: boolean;
    CellRendererComponent?: never;
}

type OtherAnimatedLegendListProps<ItemT> = Pick<PropsBase<ItemT>, KeysToOmit>;

// A component that receives a ref for the Animated.ScrollView and passes it to the LegendList
const LegendListForwardedRef = React.forwardRef(function LegendListForwardedRef<ItemT>(
    props: LegendListProps<ItemT> & { refLegendList: (r: LegendListRef | null) => void },
    ref: React.Ref<Animated.ScrollView>,
) {
    const { refLegendList, ...rest } = props;

    return (
        <LegendList
            refScrollView={ref}
            ref={(r) => {
                refLegendList(r);
            }}
            {...rest}
        />
    );
});

const AnimatedLegendListComponent = Animated.createAnimatedComponent(LegendListForwardedRef);

type AnimatedLegendListProps<ItemT> = Omit<AnimatedLegendListPropsBase<ItemT>, "refLegendList"> &
    OtherAnimatedLegendListProps<ItemT>;

type AnimatedLegendListDefinition = <ItemT>(
    props: Omit<AnimatedLegendListPropsBase<ItemT>, "refLegendList"> &
        OtherAnimatedLegendListProps<ItemT> & { ref?: React.Ref<LegendListRef> },
) => React.ReactElement | null;

interface CellRendererComponentProps {
    onLayout?: (event: LayoutChangeEvent) => void;
    children: React.ReactNode;
    style?: StyleProp<AnimatedStyle<ViewStyle>>;
}

function createCellRendererComponent(
    itemLayoutAnimationRef: React.MutableRefObject<ILayoutAnimationBuilder | undefined>,
) {
    const CellRendererComponent = (props: CellRendererComponentProps) => {
        return (
            <Animated.View layout={itemLayoutAnimationRef.current as any} onLayout={props.onLayout} style={props.style}>
                {props.children}
            </Animated.View>
        );
    };

    return CellRendererComponent;
}

const AnimatedLegendList = React.forwardRef(function AnimatedLegendList<ItemT>(
    props: AnimatedLegendListProps<ItemT>,
    ref: React.Ref<LegendListRef>,
) {
    const { refScrollView, itemLayoutAnimation, skipEnteringExitingAnimations, ...rest } =
        props as AnimatedLegendListPropsBase<ItemT>;

    const refLegendList = useRef<LegendListRef | null>(null);
    const combinedRef = useCombinedRef(refLegendList, ref);

    const itemLayoutAnimationRef = useRef<ILayoutAnimationBuilder | undefined>(itemLayoutAnimation);
    itemLayoutAnimationRef.current = itemLayoutAnimation;

    const CellRendererComponent = useMemo(
        () => createCellRendererComponent(itemLayoutAnimationRef),
        [itemLayoutAnimationRef],
    );

    const animatedList = (
        <AnimatedLegendListComponent
            refLegendList={combinedRef}
            ref={refScrollView}
            {...rest}
            // @ts-expect-error
            CellRendererComponent={CellRendererComponent}
        />
    );

    if (skipEnteringExitingAnimations === undefined) {
        return animatedList;
    }

    return (
        <LayoutAnimationConfig skipEntering skipExiting>
            {animatedList}
        </LayoutAnimationConfig>
    );
}) as AnimatedLegendListDefinition;

export { AnimatedLegendList, type AnimatedLegendListProps };
