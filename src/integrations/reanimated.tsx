import * as React from "react";
import { type ComponentProps, memo, useCallback } from "react";
import { type LayoutChangeEvent, type StyleProp, View, type ViewStyle } from "react-native";
import Reanimated, {
    useAnimatedRef,
    useAnimatedStyle,
    useScrollViewOffset,
    useSharedValue,
} from "react-native-reanimated";

import {
    LegendList,
    type LegendListProps,
    type LegendListPropsBase,
    type LegendListRef,
    type StickyHeaderConfig,
    type TypedMemo,
} from "@legendapp/list/react-native";
import { POSITION_OUT_OF_VIEW } from "@/constants";
import { IsNewArchitecture } from "@/constants-platform";
import { useCombinedRef } from "@/hooks/useCombinedRef";
import { useArr$ } from "@/state/state";
import { getComponent } from "@/utils/getComponent";

type KeysToOmit =
    | "animatedProps"
    | "getEstimatedItemSize"
    | "getFixedItemSize"
    | "getItemType"
    | "itemsAreEqual"
    | "ItemSeparatorComponent"
    | "keyExtractor"
    | "onItemSizeChanged"
    | "renderItem"
    | "renderScrollComponent";

type PropsBase<ItemT> = LegendListPropsBase<ItemT, ComponentProps<typeof Reanimated.ScrollView>>;

export interface AnimatedLegendListPropsBase<ItemT> extends Omit<PropsBase<ItemT>, KeysToOmit> {
    refScrollView?: React.Ref<Reanimated.ScrollView>;
}

type OtherAnimatedLegendListProps<ItemT> = Pick<PropsBase<ItemT>, KeysToOmit>;

const typedMemo = memo as TypedMemo;

type ReanimatedScrollBridgeProps = Omit<ComponentProps<typeof Reanimated.ScrollView>, "ref"> & {
    forwardedRef?: React.Ref<Reanimated.ScrollView>;
    scrollOffset: Reanimated.SharedValue<number>;
};

const ReanimatedScrollBridge = typedMemo(function ReanimatedScrollBridgeComponent({
    forwardedRef,
    scrollOffset,
    ...props
}: ReanimatedScrollBridgeProps) {
    const animatedScrollRef = useAnimatedRef<Reanimated.ScrollView>();
    useScrollViewOffset(animatedScrollRef as any, scrollOffset);

    const combinedRef = useCombinedRef(animatedScrollRef as any, forwardedRef as any);

    return <Reanimated.ScrollView {...props} ref={combinedRef as any} />;
});

interface ReanimatedPositionViewStickyProps {
    id: number;
    horizontal: boolean;
    style: StyleProp<ViewStyle>;
    refView: React.RefObject<View>;
    onLayout: (event: LayoutChangeEvent) => void;
    index: number;
    stickyHeaderConfig?: StickyHeaderConfig;
    stickyScrollOffset: Reanimated.SharedValue<number>;
    stickyNextPosition?: number;
    stickySize?: number;
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
    const {
        id,
        horizontal,
        style,
        refView,
        stickyScrollOffset,
        stickyHeaderConfig,
        stickyNextPosition,
        stickySize,
        index,
        children,
        ...rest
    } = props;
    const [position = POSITION_OUT_OF_VIEW, headerSize = 0, stylePaddingTop = 0] = useArr$([
        `containerPosition${id}`,
        "headerSize",
        "stylePaddingTop",
    ]);

    const configOffset = stickyHeaderConfig?.offset ?? 0;
    const stickPoint = position + headerSize + stylePaddingTop - configOffset;
    const currentStickySize = stickySize ?? 0;

    // Calculate push behavior parameters
    const hasPushBehavior = stickyNextPosition !== undefined && currentStickySize > 0;
    const pushStartScroll = hasPushBehavior
        ? stickyNextPosition + headerSize + stylePaddingTop - configOffset - currentStickySize
        : 0;
    const translateYAtPushStart = hasPushBehavior ? stickyNextPosition - currentStickySize : 0;

    const transformStyle = useAnimatedStyle(() => {
        "worklet";
        // Don't apply sticky transform if position is not yet set
        if (position === POSITION_OUT_OF_VIEW) {
            return horizontal
                ? { transform: [{ translateX: POSITION_OUT_OF_VIEW }] }
                : { transform: [{ translateY: POSITION_OUT_OF_VIEW }] };
        }

        const scroll = stickyScrollOffset.value;

        let translateY: number;

        if (hasPushBehavior) {
            if (scroll <= stickPoint) {
                // Before sticking - natural position
                translateY = position;
            } else if (scroll <= pushStartScroll) {
                // Stuck at top - translateY increases with scroll
                translateY = position + (scroll - stickPoint);
            } else {
                // Being pushed - translateY stays constant
                translateY = translateYAtPushStart;
            }
        } else {
            // Simple sticky without push
            const delta = Math.max(0, scroll - stickPoint);
            translateY = position + delta;
        }

        return horizontal ? { transform: [{ translateX: translateY }] } : { transform: [{ translateY }] };
    }, [horizontal, position, stickPoint, hasPushBehavior, pushStartScroll, translateYAtPushStart]);

    const viewStyle = React.useMemo(
        () => [style, { zIndex: index + 1000 }, transformStyle],
        [index, style, transformStyle],
    );

    return (
        <Reanimated.View ref={refView as any} style={viewStyle} {...rest}>
            <StickyOverlay stickyHeaderConfig={stickyHeaderConfig} />
            {children}
        </Reanimated.View>
    );
});

interface StickyPositionComponentInternalProps {
    id: number;
    horizontal: boolean;
    style: StyleProp<ViewStyle>;
    refView: React.RefObject<View>;
    onLayout: (event: LayoutChangeEvent) => void;
    index: number;
    stickyHeaderConfig?: StickyHeaderConfig;
    stickyNextPosition?: number;
    stickySize?: number;
    children: React.ReactNode;
}

// A component that receives a ref for the Animated.ScrollView and passes it to the LegendList
const LegendListForwardedRef = typedMemo(
    // biome-ignore lint/nursery/noShadow: const function name shadowing is intentional
    React.forwardRef(function LegendListForwardedRef<ItemT>(
        props: AnimatedLegendListPropsBase<ItemT> & { refLegendList: (r: LegendListRef | null) => void },
        ref: React.Ref<Reanimated.ScrollView>,
    ) {
        const { refLegendList, ...rest } = props;

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
                function StickyPositionComponent(stickyProps: StickyPositionComponentInternalProps) {
                    return <ReanimatedPositionViewSticky {...stickyProps} stickyScrollOffset={stickyScrollOffset} />;
                },
            [stickyScrollOffset],
        );

        const legendListProps = shouldUseReanimatedScrollView
            ? ({
                  ...rest,
                  renderScrollComponent: renderReanimatedScrollComponent,
                  stickyPositionComponentInternal,
              } as LegendListProps<ItemT>)
            : rest;

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
