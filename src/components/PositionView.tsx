import type { CSSProperties } from "react";
import * as React from "react";

import { POSITION_OUT_OF_VIEW } from "@/constants";
import type { LayoutRectangle } from "@/platform/platform-types";
import { useArr$ } from "@/state/state";
import { type StickyHeaderConfig, typedMemo } from "@/types.base";
import { isArray } from "@/utils/helpers";

interface ExtraPropsFromRN {
    animatedScrollY: any;
    onLayout: any;
    onLayoutChange?: any;
    stickyHeaderConfig?: StickyHeaderConfig;
}

interface PositionViewStateProps {
    id: number;
    index: number;
    horizontal: boolean;
    style: CSSProperties;
    refView: React.RefObject<HTMLDivElement>;
    onLayoutChange?: (rectangle: LayoutRectangle, fromLayoutEffect: boolean) => void;
    onLayout?: unknown;
    children: React.ReactNode;
}

// biome-ignore lint/nursery/noShadow: const function name shadowing is intentional
const PositionViewState = typedMemo(function PositionViewState({
    id,
    horizontal,
    style,
    refView,
    ...props
}: PositionViewStateProps) {
    const [position = POSITION_OUT_OF_VIEW] = useArr$([`containerPosition${id}`]);

    const base: CSSProperties = {
        contain: "paint layout style",
    };
    // Merge to a single CSSProperties object and avoid RN-style transform arrays
    const composed: CSSProperties = isArray(style)
        ? (Object.assign({}, ...style) as CSSProperties)
        : (style as unknown as CSSProperties);
    const combinedStyle: CSSProperties = horizontal
        ? ({ ...base, ...composed, left: position } as CSSProperties)
        : ({ ...base, ...composed, top: position } as CSSProperties);

    // biome-ignore lint/correctness/noUnusedVariables: Spreading out invalid DOM props
    const { animatedScrollY, onLayout, onLayoutChange: _onLayoutChange, index, stickyHeaderConfig: _stickyHeaderConfig, ...webProps } =
        props as PositionViewStateProps & ExtraPropsFromRN;

    return <div ref={refView} {...(webProps as any)} style={combinedStyle as any} />;
});

// biome-ignore lint/nursery/noShadow: const function name shadowing is intentional
export const PositionViewSticky = typedMemo(function PositionViewSticky({
    id,
    horizontal,
    style,
    refView,
    index,
    animatedScrollY: _animatedScrollY,
    stickyHeaderConfig,
    onLayout: _onLayout,
    onLayoutChange: _onLayoutChange,
    children,
    ...rest
}: {
    id: number;
    horizontal: boolean;
    style: CSSProperties;
    refView: React.RefObject<HTMLDivElement>;
    onLayoutChange?: (rectangle: LayoutRectangle, fromLayoutEffect: boolean) => void;
    index: number;
    animatedScrollY?: unknown;
    stickyHeaderConfig?: StickyHeaderConfig;
    onLayout?: unknown;
    children: React.ReactNode;
}) {
    const [position = POSITION_OUT_OF_VIEW, activeStickyIndex] = useArr$([
        `containerPosition${id}`,
        "activeStickyIndex",
    ]);

    const base: CSSProperties = {
        contain: "paint layout style",
    };
    const composed = React.useMemo(
        () =>
            (isArray(style) ? (Object.assign({}, ...style) as CSSProperties) : (style as unknown as CSSProperties)) ??
            {},
        [style],
    );

    const viewStyle = React.useMemo(() => {
        const styleBase: CSSProperties = { ...base, ...composed };
        delete styleBase.transform;

        const stickyConfigOffset = stickyHeaderConfig?.offset ?? 0;
        const offset = stickyConfigOffset ?? 0;
        const isActive = activeStickyIndex === index;
        styleBase.position = isActive ? "sticky" : "absolute";
        styleBase.zIndex = index + 1000;

        if (horizontal) {
            styleBase.left = isActive ? offset : position;
        } else {
            styleBase.top = isActive ? offset : position;
        }

        return styleBase;
    }, [composed, horizontal, position, index, activeStickyIndex, stickyHeaderConfig?.offset]);

    return (
        <div ref={refView} style={viewStyle as any} {...rest}>
            {children}
        </div>
    );
});

export const PositionView = PositionViewState;
