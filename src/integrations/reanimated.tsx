import * as React from "react";
import { type ComponentProps, useCallback } from "react";
import { type LayoutChangeEvent, type ScrollViewProps, type StyleProp, View, type ViewStyle } from "react-native";
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
} from "@legendapp/list/react-native";

const {
    POSITION_OUT_OF_VIEW,
    IsNewArchitecture,
    getStickyPushLimit,
    typedMemo,
    useArr$,
    useCombinedRef,
    useLatestRef,
    useStableRenderComponent,
    getComponent,
} = internal;
const { peek$, useStateContext } = internal;

type KeysToOmit =
    | "getEstimatedItemSize"
    | "getFixedItemSize"
    | "getItemType"
    | "itemsAreEqual"
    | "ItemSeparatorComponent"
    | "keyExtractor"
    | "onItemSizeChanged"
    | "renderItem";

type PropsBase<ItemT> = LegendListProps<ItemT>;
type AnimatedScrollView = React.ElementRef<typeof Reanimated.ScrollView>;
type ReanimatedScrollViewProps = Omit<ComponentProps<typeof Reanimated.ScrollView>, "ref">;
type ReanimatedScrollRenderProps = ReanimatedScrollViewProps & {
    ref?: React.Ref<AnimatedScrollView>;
};

type ReanimatedLayoutAnimation = ComponentProps<typeof Reanimated.View>["layout"];

export interface AnimatedLegendListSharedValues {
    activeStickyIndex?: SharedValue<number>;
    isAtEnd?: SharedValue<boolean>;
    isAtStart?: SharedValue<boolean>;
    isNearEnd?: SharedValue<boolean>;
    isNearStart?: SharedValue<boolean>;
    isWithinMaintainScrollAtEndThreshold?: SharedValue<boolean>;
    scrollOffset?: SharedValue<number>;
}

export interface AnimatedLegendListPropsBase<ItemT> extends Omit<PropsBase<ItemT>, KeysToOmit | "refScrollView"> {
    animatedProps?: ComponentProps<typeof Reanimated.ScrollView>["animatedProps"];
    refScrollView?: React.Ref<AnimatedScrollView>;
    sharedValues?: AnimatedLegendListSharedValues;
    /**
     * Reanimated layout transition applied to each item container position view.
     * Example: `LinearTransition.duration(280)`.
     */
    itemLayoutAnimation?: ReanimatedLayoutAnimation;
}

type OtherAnimatedLegendListProps<ItemT> = Pick<PropsBase<ItemT>, KeysToOmit>;

type ReanimatedScrollBridgeProps = ReanimatedScrollViewProps & {
    forwardedRef?: React.Ref<AnimatedScrollView>;
    scrollOffset: SharedValue<number>;
    renderScrollComponent?: (props: ReanimatedScrollRenderProps) => React.ReactElement | null;
};

const ReanimatedScrollBridge = typedMemo(function ReanimatedScrollBridgeComponent({
    forwardedRef,
    scrollOffset,
    renderScrollComponent,
    ...props
}: ReanimatedScrollBridgeProps) {
    const animatedScrollRef = useAnimatedRef<AnimatedScrollView>();
    useScrollViewOffset(animatedScrollRef, scrollOffset);

    const combinedRef = useCombinedRef<AnimatedScrollView>(animatedScrollRef, forwardedRef);

    const CustomScrollComponent = useStableRenderComponent<
        ReanimatedScrollViewProps,
        ReanimatedScrollRenderProps,
        AnimatedScrollView
    >(renderScrollComponent, (scrollViewProps: ReanimatedScrollViewProps, ref) => ({
        ...scrollViewProps,
        ref,
        scrollEventThrottle: 1,
    }));
    const ScrollComponent = renderScrollComponent ? CustomScrollComponent : Reanimated.ScrollView;

    return <ScrollComponent {...props} ref={combinedRef} />;
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
    const ctx = useStateContext();
    const { id, horizontal, style, refView, stickyScrollOffset, stickyHeaderConfig, index, children, ...rest } = props;
    const [position = POSITION_OUT_OF_VIEW, headerSize = 0, stylePaddingTop = 0, itemKey, _totalSize = 0] = useArr$([
        `containerPosition${id}`,
        "headerSize",
        "stylePaddingTop",
        `containerItemKey${id}`,
        "totalSize",
    ]);
    const pushLimit = React.useMemo(
        () => getStickyPushLimit(ctx.state, index, itemKey),
        [ctx.state, index, itemKey, _totalSize],
    );

    const stickyOffset = stickyHeaderConfig?.offset ?? 0;
    const stickyStart = position + headerSize + stylePaddingTop - stickyOffset;

    const stickyPositionStyle = useAnimatedStyle(() => {
        const delta = Math.max(0, stickyScrollOffset.value - stickyStart);
        const stickyPosition = position + delta;
        const resolvedPosition = pushLimit !== undefined ? Math.min(stickyPosition, pushLimit) : stickyPosition;

        return horizontal
            ? { transform: [{ translateX: resolvedPosition }] }
            : { transform: [{ translateY: resolvedPosition }] };
    }, [horizontal, position, pushLimit, stickyStart]);

    const viewStyle = React.useMemo(
        () => [style, { zIndex: index + 1000 }, stickyPositionStyle],
        [index, stickyPositionStyle, style],
    );

    return (
        <Reanimated.View ref={refView} style={viewStyle} {...rest}>
            <StickyOverlay stickyHeaderConfig={stickyHeaderConfig} />
            {children}
        </Reanimated.View>
    );
});

const ReanimatedPositionView = typedMemo(function ReanimatedPositionViewComponent(props: ReanimatedPositionViewProps) {
    const ctx = useStateContext();
    const { id, horizontal, style, refView, children, recycleItems, layoutTransition, ...rest } = props;
    const [positionValue = POSITION_OUT_OF_VIEW] = useArr$([`containerPosition${id}`]);
    const prevItemKeyRef = React.useRef<string | undefined>(undefined);
    let shouldSkipTransitionForRecycleReuse = false;

    if (recycleItems && layoutTransition) {
        const itemKeySignal = `containerItemKey${id}` as `containerItemKey${number}`;
        const itemKey = peek$(ctx, itemKeySignal) as string | undefined;

        shouldSkipTransitionForRecycleReuse =
            itemKey !== undefined && prevItemKeyRef.current !== undefined && prevItemKeyRef.current !== itemKey;
        if (itemKey !== undefined) {
            prevItemKeyRef.current = itemKey;
        }
    } else {
        prevItemKeyRef.current = undefined;
    }

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

interface LegendListForwardedRefProps<ItemT> extends AnimatedLegendListPropsBase<ItemT> {
    /**
     * Internal bridge-only prop used to feed Reanimated animatedProps into LegendList's ScrollView.
     * Not part of the public AnimatedLegendList API.
     */
    animatedPropsInternal?: ComponentProps<typeof Reanimated.ScrollView>["animatedProps"];
    refLegendList: (r: LegendListRef | null) => void;
}

function setSharedValueValue<T>(sharedValue: SharedValue<T> | undefined, value: T) {
    if (!sharedValue) {
        return;
    }

    const sharedValueWithMethods = sharedValue as SharedValue<T> & {
        get?: () => T;
        set?: (value: T) => void;
        value: T;
    };

    if (typeof sharedValueWithMethods.set === "function") {
        sharedValueWithMethods.set(value);
    } else {
        sharedValueWithMethods.value = value;
    }
}

function useAnimatedLegendListSharedValuesSync(
    legendList: LegendListRef | null,
    sharedValues: AnimatedLegendListSharedValues | undefined,
) {
    React.useEffect(() => {
        if (!legendList || !sharedValues) {
            return;
        }

        const state = legendList.getState();
        setSharedValueValue(sharedValues.activeStickyIndex, state.activeStickyIndex);
        setSharedValueValue(sharedValues.isAtEnd, state.isAtEnd);
        setSharedValueValue(sharedValues.isAtStart, state.isAtStart);
        setSharedValueValue(sharedValues.isNearEnd, state.isNearEnd);
        setSharedValueValue(sharedValues.isNearStart, state.isNearStart);
        setSharedValueValue(
            sharedValues.isWithinMaintainScrollAtEndThreshold,
            state.isWithinMaintainScrollAtEndThreshold,
        );
        setSharedValueValue(sharedValues.scrollOffset, state.scroll);

        const unsubscribers = [
            sharedValues.activeStickyIndex
                ? state.listen("activeStickyIndex", (value) =>
                      setSharedValueValue(sharedValues.activeStickyIndex, value),
                  )
                : undefined,
            sharedValues.isAtEnd
                ? state.listen("isAtEnd", (value) => setSharedValueValue(sharedValues.isAtEnd, value))
                : undefined,
            sharedValues.isAtStart
                ? state.listen("isAtStart", (value) => setSharedValueValue(sharedValues.isAtStart, value))
                : undefined,
            sharedValues.isNearEnd
                ? state.listen("isNearEnd", (value) => setSharedValueValue(sharedValues.isNearEnd, value))
                : undefined,
            sharedValues.isNearStart
                ? state.listen("isNearStart", (value) => setSharedValueValue(sharedValues.isNearStart, value))
                : undefined,
            sharedValues.isWithinMaintainScrollAtEndThreshold
                ? state.listen("isWithinMaintainScrollAtEndThreshold", (value) =>
                      setSharedValueValue(sharedValues.isWithinMaintainScrollAtEndThreshold, value),
                  )
                : undefined,
        ];

        return () => {
            for (const unsubscribe of unsubscribers) {
                unsubscribe?.();
            }
        };
    }, [legendList, sharedValues]);
}

// A component that receives a ref for the Animated.ScrollView and passes it to the LegendList
const LegendListForwardedRef = typedMemo(
    // biome-ignore lint/nursery/noShadow: const function name shadowing is intentional
    React.forwardRef(function LegendListForwardedRef<ItemT>(
        props: LegendListForwardedRefProps<ItemT>,
        ref: React.Ref<AnimatedScrollView>,
    ) {
        const { itemLayoutAnimation, recycleItems, refLegendList, renderScrollComponent, sharedValues, ...rest } =
            props;

        const refFn = useCallback(
            (r: LegendListRef) => {
                refLegendList(r);
            },
            [refLegendList],
        );
        const internalScrollOffset = useSharedValue(0);
        const scrollOffset = sharedValues?.scrollOffset ?? internalScrollOffset;

        const shouldUseReanimatedScrollView = true;
        const renderScrollComponentForBridge = React.useMemo<ReanimatedScrollBridgeProps["renderScrollComponent"]>(
            () =>
                renderScrollComponent
                    ? (scrollViewProps: ReanimatedScrollRenderProps) =>
                          renderScrollComponent(scrollViewProps as unknown as ScrollViewProps)
                    : undefined,
            [renderScrollComponent],
        );

        const renderReanimatedScrollComponent = useCallback(
            (scrollViewProps: ReanimatedScrollRenderProps) => {
                const { ref: forwardedRef, ...restScrollViewProps } = scrollViewProps;

                return (
                    <ReanimatedScrollBridge
                        {...restScrollViewProps}
                        forwardedRef={forwardedRef}
                        renderScrollComponent={renderScrollComponentForBridge}
                        scrollOffset={scrollOffset}
                    />
                );
            },
            [renderScrollComponentForBridge, scrollOffset],
        );

        const stickyPositionComponentInternal = React.useMemo(
            () =>
                function StickyPositionComponent(stickyProps: PositionComponentInternalProps) {
                    return <ReanimatedPositionViewSticky {...stickyProps} stickyScrollOffset={scrollOffset} />;
                },
            [scrollOffset],
        );

        const itemLayoutAnimationRef = useLatestRef(itemLayoutAnimation);
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
            recycleItems,
            ...(shouldUseReanimatedScrollView
                ? {
                      renderScrollComponent: renderReanimatedScrollComponent,
                      ...(IsNewArchitecture ? { stickyPositionComponentInternal } : {}),
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

type AnimatedLegendListComponentDefinition = <ItemT>(
    props: LegendListForwardedRefProps<ItemT> & { ref?: React.Ref<AnimatedScrollView> },
) => React.ReactElement | null;

const AnimatedLegendListComponentTyped =
    AnimatedLegendListComponent as unknown as AnimatedLegendListComponentDefinition;

// A component that has the shape of LegendList which passes the ref down as refLegendList
const AnimatedLegendList = typedMemo(
    // biome-ignore lint/nursery/noShadow: const function name shadowing is intentional
    React.forwardRef(function AnimatedLegendList<ItemT>(
        props: AnimatedLegendListProps<ItemT>,
        ref: React.Ref<LegendListRef>,
    ) {
        const { refScrollView, ...rest } = props as AnimatedLegendListProps<ItemT>;
        const { animatedProps, sharedValues } = props;

        const [legendList, setLegendList] = React.useState<LegendListRef | null>(null);
        const combinedRef = useCombinedRef<LegendListRef>(
            React.useCallback((instance: LegendListRef | null) => {
                setLegendList((prev) => (prev === instance ? prev : instance));
            }, []),
            ref,
        );
        useAnimatedLegendListSharedValuesSync(legendList, sharedValues);
        const forwardedProps = {
            ...(rest as Omit<LegendListForwardedRefProps<ItemT>, "animatedPropsInternal" | "refLegendList">),
            animatedPropsInternal: animatedProps,
            refLegendList: combinedRef,
        };

        return <AnimatedLegendListComponentTyped {...forwardedProps} ref={refScrollView} />;
    }),
) as AnimatedLegendListDefinition;

export { AnimatedLegendList, type AnimatedLegendListProps };
