import * as React from "react";

import { LeanLayoutView } from "@/components/LeanLayoutView.native";
import { LeanView } from "@/components/LeanView";
import { POSITION_OUT_OF_VIEW } from "@/constants";
import { IsNewArchitecture } from "@/constants-platform";
import { useSyncLayout } from "@/hooks/useSyncLayout";
import { useValue$ } from "@/hooks/useValue$";
import { AnimatedView } from "@/platform/AnimatedComponents";
import type { AnimatedValueLike } from "@/platform/AnimatedValue";
import type { LayoutChangeEvent, LayoutRectangle } from "@/platform/Layout";
import type { ViewStyle, WebViewMethods } from "@/platform/View";
import { useArr$ } from "@/state/state";
import { typedMemo } from "@/types";

const PositionViewState = typedMemo(function PositionView({
    id,
    horizontal,
    style,
    refView,
    onLayoutChange,
    ...rest
}: {
    id: number;
    horizontal: boolean;
    style: ViewStyle | ViewStyle[];
    refView: React.RefObject<HTMLDivElement & WebViewMethods>;
    onLayoutChange: (rectangle: LayoutRectangle, fromLayoutEffect: boolean) => void;
    children: React.ReactNode;
}) {
    const [position = POSITION_OUT_OF_VIEW] = useArr$([`containerPosition${id}`]);

    return (
        <LeanLayoutView
            onLayoutChange={onLayoutChange}
            refView={refView}
            style={{
                ...(Array.isArray(style) ? Object.assign({}, ...style) : style),
                ...(horizontal ? { transform: [{ translateX: position }] } : { transform: [{ translateY: position }] }),
            }}
            {...rest}
        />
    );
});

const PositionViewAnimated = typedMemo(function PositionView({
    id,
    horizontal,
    style,
    refView,
    onLayoutChange,
    ...rest
}: {
    id: number;
    horizontal: boolean;
    style: ViewStyle | ViewStyle[];
    refView: React.RefObject<HTMLDivElement & WebViewMethods>;
    onLayoutChange: (rectangle: LayoutRectangle, fromLayoutEffect: boolean) => void;
    children: React.ReactNode;
}) {
    const position$ = useValue$(`containerPosition${id}`, {
        getValue: (v) => v ?? POSITION_OUT_OF_VIEW,
    });

    useSyncLayout({ onChange: onLayoutChange, ref: refView });

    return (
        <AnimatedView
            ref={refView}
            style={{
                ...(Array.isArray(style) ? Object.assign({}, ...style) : style),
                ...(horizontal
                    ? { transform: [{ translateX: position$ }] }
                    : { transform: [{ translateY: position$ }] }),
            }}
            {...rest}
        />
    );
});

const PositionViewSticky = typedMemo(function PositionViewSticky({
    id,
    horizontal,
    style,
    refView,
    animatedScrollY,
    stickyOffset,
    index,
    ...rest
}: {
    id: number;
    horizontal: boolean;
    style: ViewStyle | ViewStyle[];
    refView: React.RefObject<HTMLDivElement & WebViewMethods>;
    animatedScrollY?: AnimatedValueLike;
    stickyOffset?: AnimatedValueLike;
    onLayout: (event: LayoutChangeEvent) => void;
    index: number;
    children: React.ReactNode;
}) {
    const [position = POSITION_OUT_OF_VIEW] = useArr$([`containerPosition${id}`]);

    // Calculate transform based on sticky state
    const transform = React.useMemo(() => {
        if (animatedScrollY && stickyOffset) {
            // On web, animatedScrollY is a number. Sticky transforms are handled by DOM ordering.
            // On native, this path isn't used as this is a .native file.
            return horizontal ? [{ translateX: position }] : [{ translateY: position }];
        }
        return undefined;
    }, [position, horizontal, animatedScrollY, stickyOffset]);

    const viewStyle = React.useMemo(
        () => ({
            ...(Array.isArray(style) ? Object.assign({}, ...style) : style),
            transform,
            zIndex: index + 1000,
        }),
        [style, transform, index],
    );

    return <AnimatedView ref={refView} style={viewStyle} {...rest} />;
});

export const PositionView = IsNewArchitecture ? PositionViewState : PositionViewAnimated;
export { PositionViewSticky };
