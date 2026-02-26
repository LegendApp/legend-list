import * as React from "react";
import { type ComponentProps, memo, useCallback } from "react";
import { type LayoutChangeEvent, type StyleProp, View, type ViewStyle } from "react-native";
import Reanimated, {
    type SharedValue,
    useAnimatedRef,
    useAnimatedStyle,
    useScrollViewOffset,
    useSharedValue,
} from "react-native-reanimated";

import {
    internal,
    LegendList,
    type LegendListProps,
    type LegendListRef,
    type StickyHeaderConfig,
    type TypedMemo,
} from "@legendapp/list/react-native";

const { POSITION_OUT_OF_VIEW, IsNewArchitecture, useArr$, useCombinedRef, getComponent } = internal;

type KeysToOmit =
    | "getEstimatedItemSize"
    | "getFixedItemSize"
    | "getItemType"
    | "itemsAreEqual"
    | "ItemSeparatorComponent"
    | "keyExtractor"
    | "onItemSizeChanged"
    | "renderItem"
    | "renderScrollComponent";

type PropsBase<ItemT> = LegendListProps<ItemT>;

type ReanimatedLayoutAnimation = ComponentProps<typeof Reanimated.View>["layout"];

export interface AnimatedLegendListPropsBase<ItemT> extends Omit<PropsBase<ItemT>, KeysToOmit | "refScrollView"> {
    animatedProps?: ComponentProps<typeof Reanimated.ScrollView>["animatedProps"];
    refScrollView?: React.Ref<Reanimated.ScrollView>;
    /**
     * Reanimated layout transition applied to each item container position view.
     * Example: `LinearTransition.duration(280)`.
     */
    itemLayoutAnimation?: ReanimatedLayoutAnimation;
}

type OtherAnimatedLegendListProps<ItemT> = Pick<PropsBase<ItemT>, KeysToOmit>;

const typedMemo = memo as TypedMemo;

type ReanimatedScrollBridgeProps = Omit<ComponentProps<typeof Reanimated.ScrollView>, "ref"> & {
    forwardedRef?: React.Ref<Reanimated.ScrollView>;
    scrollOffset: SharedValue<number>;
};

const ReanimatedScrollBridge = typedMemo(function ReanimatedScrollBridgeComponent({
    forwardedRef,
    scrollOffset,
    ...props
}: ReanimatedScrollBridgeProps) {
    const animatedScrollRef = useAnimatedRef<Reanimated.ScrollView>();
    useScrollViewOffset(animatedScrollRef, scrollOffset);

    const combinedRef = useCombinedRef<Reanimated.ScrollView>(animatedScrollRef, forwardedRef);

    return <Reanimated.ScrollView {...props} ref={combinedRef} />;
});

interface ReanimatedPositionViewStickyProps {
    id: number;
    horizontal: boolean;
    style: StyleProp<ViewStyle>;
    refView: React.RefObject<View | null>;
    onLayout: (event: LayoutChangeEvent) => void;
    index: number;
    stickyHeaderConfig?: StickyHeaderConfig;
    stickyScrollOffset: SharedValue<number>;
    children: React.ReactNode;
}

interface ReanimatedPositionViewProps {
    id: number;
    horizontal: boolean;
    style: StyleProp<ViewStyle>;
    refView: React.RefObject<View | null>;
    onLayout: (event: LayoutChangeEvent) => void;
    index: number;
    recycleItems?: boolean;
    layoutTransition?: ReanimatedLayoutAnimation;
    children: React.ReactNode;
}

type StickyOverlayProps = {
    stickyHeaderConfig?: StickyHeaderConfig;
};

const StickyOverlay = typedMemo(function StickyOverlayComponent({ stickyHeaderConfig }: StickyOverlayProps) {
    if (!stickyHeaderConfig?.backdropComponent) {
        return null;
    }

    return (
        <View
            style={{
                inset: 0,
                pointerEvents: "none",
                position: "absolute",
            }}
        >
            {getComponent(stickyHeaderConfig?.backdropComponent)}
        </View>
    );
});

const ReanimatedPositionViewSticky = typedMemo(function ReanimatedPositionViewStickyComponent(
    props: ReanimatedPositionViewStickyProps,
) {
    const { id, horizontal, style, refView, stickyScrollOffset, stickyHeaderConfig, index, children, ...rest } = props;
    const [position = POSITION_OUT_OF_VIEW, headerSize = 0, stylePaddingTop = 0] = useArr$([
        `containerPosition${id}`,
        "headerSize",
        "stylePaddingTop",
    ]);

    const stickyOffset = stickyHeaderConfig?.offset ?? 0;
    const stickyStart = position + headerSize + stylePaddingTop - stickyOffset;

    const transformStyle = useAnimatedStyle(() => {
        const delta = Math.max(0, stickyScrollOffset.value - stickyStart);

        return horizontal
            ? { transform: [{ translateX: position + delta }] }
            : { transform: [{ translateY: position + delta }] };
    }, [horizontal, position, stickyStart]);

    const viewStyle = React.useMemo(
        () => [style, { zIndex: index + 1000 }, transformStyle],
        [index, style, transformStyle],
    );

    return (
        <Reanimated.View ref={refView} style={viewStyle} {...rest}>
            <StickyOverlay stickyHeaderConfig={stickyHeaderConfig} />
            {children}
        </Reanimated.View>
    );
});

const ReanimatedPositionView = typedMemo(function ReanimatedPositionViewComponent(props: ReanimatedPositionViewProps) {
    const { id, horizontal, style, refView, children, recycleItems, layoutTransition, ...rest } = props;
    const [positionValue = POSITION_OUT_OF_VIEW, itemKey] = useArr$([
        `containerPosition${id}`,
        `containerItemKey${id}`,
    ]);
    const prevItemKeyRef = React.useRef<string | undefined>(undefined);

    const shouldSkipTransitionForRecycleReuse =
        !!recycleItems &&
        itemKey !== undefined &&
        prevItemKeyRef.current !== undefined &&
        prevItemKeyRef.current !== itemKey;

    React.useEffect(() => {
        if (itemKey !== undefined) {
            prevItemKeyRef.current = itemKey;
        }
    }, [itemKey]);

    // Layout transitions require positional layout props instead of transform.
    const viewStyle = React.useMemo(
        () => [style, horizontal ? { left: positionValue } : { top: positionValue }],
        [horizontal, positionValue, style],
    );

    return (
        <Reanimated.View
            layout={shouldSkipTransitionForRecycleReuse ? undefined : layoutTransition}
            ref={refView}
            style={viewStyle}
            {...rest}
        >
            {children}
        </Reanimated.View>
    );
});

interface PositionComponentInternalProps {
    id: number;
    horizontal: boolean;
    style: StyleProp<ViewStyle>;
    refView: React.RefObject<View | null>;
    onLayout: (event: LayoutChangeEvent) => void;
    index: number;
    stickyHeaderConfig?: StickyHeaderConfig;
    children: React.ReactNode;
}

// A component that receives a ref for the Animated.ScrollView and passes it to the LegendList
const LegendListForwardedRef = typedMemo(
    // biome-ignore lint/nursery/noShadow: const function name shadowing is intentional
    React.forwardRef(function LegendListForwardedRef<ItemT>(
        props: AnimatedLegendListPropsBase<ItemT> & { refLegendList: (r: LegendListRef | null) => void },
        ref: React.Ref<Reanimated.ScrollView>,
    ) {
        const { itemLayoutAnimation, recycleItems, refLegendList, ...rest } = props;

        const refFn = useCallback(
            (r: LegendListRef) => {
                refLegendList(r);
            },
            [refLegendList],
        );
        const stickyScrollOffset = useSharedValue(0);

        const shouldUseReanimatedScrollView = IsNewArchitecture;

        const renderReanimatedScrollComponent = useCallback(
            (scrollViewProps: ComponentProps<typeof Reanimated.ScrollView>) => {
                const { ref: forwardedRef, ...restScrollViewProps } = scrollViewProps as ComponentProps<
                    typeof Reanimated.ScrollView
                > & {
                    ref?: React.Ref<Reanimated.ScrollView>;
                };

                return (
                    <ReanimatedScrollBridge
                        {...restScrollViewProps}
                        forwardedRef={forwardedRef}
                        scrollOffset={stickyScrollOffset}
                    />
                );
            },
            [stickyScrollOffset],
        );

        const stickyPositionComponentInternal = React.useMemo(
            () =>
                function StickyPositionComponent(stickyProps: PositionComponentInternalProps) {
                    return <ReanimatedPositionViewSticky {...stickyProps} stickyScrollOffset={stickyScrollOffset} />;
                },
            [stickyScrollOffset],
        );

        const itemLayoutAnimationRef = React.useRef(itemLayoutAnimation);
        itemLayoutAnimationRef.current = itemLayoutAnimation;
        const hasItemLayoutAnimation = !!itemLayoutAnimation;

        const positionComponentInternal = React.useMemo(() => {
            if (!hasItemLayoutAnimation) {
                return undefined;
            }

            return function PositionComponent(positionProps: PositionComponentInternalProps) {
                return (
                    <ReanimatedPositionView
                        {...positionProps}
                        layoutTransition={itemLayoutAnimationRef.current}
                        recycleItems={recycleItems}
                    />
                );
            };
        }, [hasItemLayoutAnimation, recycleItems]);

        const legendListProps = {
            ...rest,
            positionComponentInternal,
            ...(shouldUseReanimatedScrollView
                ? {
                      renderScrollComponent: renderReanimatedScrollComponent,
                      stickyPositionComponentInternal,
                  }
                : {}),
        };

        return <LegendList ref={refFn} refScrollView={ref} {...(legendListProps as LegendListProps<ItemT>)} />;
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
        const { refScrollView, ...rest } = props as AnimatedLegendListProps<ItemT>;
        const { animatedProps } = props;

        const refLegendList = React.useRef<LegendListRef | null>(null);

        const combinedRef = useCombinedRef(refLegendList, ref);

        return (
            <AnimatedLegendListComponent
                animatedPropsInternal={animatedProps}
                ref={refScrollView}
                refLegendList={combinedRef}
                {...(rest as any)}
            />
        );
    }),
) as AnimatedLegendListDefinition;

export { AnimatedLegendList, type AnimatedLegendListProps };
