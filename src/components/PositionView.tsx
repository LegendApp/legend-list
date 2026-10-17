import type { CSSProperties } from "react";
import * as React from "react";

import { POSITION_OUT_OF_VIEW } from "@/constants";
import type { LayoutRectangle } from "@/platform/platform-types";
import { useArr$ } from "@/state/state";
import type { StickyHeaderConfig } from "@/types.base";
import { typedMemo } from "@/types.internal";
import { getComponent } from "@/utils/getComponent";
import { isArray } from "@/utils/helpers";

interface ExtraPropsFromRN {
    animatedScrollY?: unknown;
    onLayout?: unknown;
    onLayoutChange?: (rectangle: LayoutRectangle, fromLayoutEffect: boolean) => void;
    stickyHeaderConfig?: StickyHeaderConfig;
}

interface PositionViewStateProps {
    id: number;
    horizontal: boolean;
    style: CSSProperties;
    refView: React.RefObject<HTMLDivElement | null>;
    onLayoutChange?: (rectangle: LayoutRectangle, fromLayoutEffect: boolean) => void;
    onLayout?: unknown;
    children: React.ReactNode;
}

const isRNWeb = typeof document !== "undefined" && !!document.getElementById("react-native-stylesheet");
const baseCss: CSSProperties = {
    contain: "paint layout style",
    ...(isRNWeb
        ? {
              display: "flex",
              flexDirection: "column",
          }
        : {}),
};

const horizontalCss: CSSProperties = { width: "max-content" };

// biome-ignore lint/nursery/noShadow: const function name shadowing is intentional
const PositionViewState = typedMemo(function PositionViewState({
    id,
    horizontal,
    style,
    refView,
    ...props
}: PositionViewStateProps) {
    const [position = POSITION_OUT_OF_VIEW] = useArr$([`containerPosition${id}`]);

    // Merge to a single CSSProperties object and avoid RN-style transform arrays
    const composed: CSSProperties = isArray(style)
        ? (Object.assign({}, ...style) as CSSProperties)
        : (style as unknown as CSSProperties);
    const combinedStyle: CSSProperties = horizontal
        ? ({ ...baseCss, ...horizontalCss, ...composed, left: position } as CSSProperties)
        : ({ ...baseCss, ...composed, top: position } as CSSProperties);

    const {
        animatedScrollY: _animatedScrollY,
        onLayout: _onLayout,
        onLayoutChange: _onLayoutChange,
        stickyHeaderConfig: _stickyHeaderConfig,
        ...webProps
    } = props as PositionViewStateProps & ExtraPropsFromRN;

    return <div ref={refView} {...(webProps as any)} style={combinedStyle} />;
});

// biome-ignore lint/nursery/noShadow: const function name shadowing is intentional
export const PositionViewSticky = typedMemo(function PositionViewSticky({
    id,
    horizontal,
    style,
    refView,
    animatedScrollY: _animatedScrollY,
    stickyHeaderConfig,
    onLayout: _onLayout,
    onLayoutChange: _onLayoutChange,
    children,
    ...webProps
}: {
    id: number;
    horizontal: boolean;
    style: CSSProperties;
    refView: React.RefObject<HTMLDivElement | null>;
    onLayoutChange?: (rectangle: LayoutRectangle, fromLayoutEffect: boolean) => void;
    animatedScrollY?: unknown;
    stickyHeaderConfig?: StickyHeaderConfig;
    onLayout?: unknown;
    children: React.ReactNode;
}) {
    const [position = POSITION_OUT_OF_VIEW, activeStickyIndex, itemIndex] = useArr$([
        `containerPosition${id}`,
        "activeStickyIndex",
        `containerItemIndex${id}`,
    ]);

    const composed = React.useMemo(
        () =>
            (isArray(style) ? (Object.assign({}, ...style) as CSSProperties) : (style as unknown as CSSProperties)) ??
            {},
        [style],
    );

    const viewStyle = React.useMemo(() => {
        const styleBase: CSSProperties = { ...baseCss, ...(horizontal ? horizontalCss : {}), ...composed };
        delete styleBase.transform;

        const offset = stickyHeaderConfig?.offset ?? 0;
        const isActive = activeStickyIndex === itemIndex;
        styleBase.position = isActive ? "sticky" : "absolute";
        styleBase.zIndex = itemIndex + 1000;

        if (horizontal) {
            styleBase.left = isActive ? offset : position;
        } else {
            styleBase.top = isActive ? offset : position;
        }

        return styleBase;
    }, [composed, horizontal, position, itemIndex, activeStickyIndex, stickyHeaderConfig?.offset]);

    const renderStickyHeaderBackdrop = React.useMemo(
        () =>
            stickyHeaderConfig?.backdropComponent ? (
                <div
                    style={{
                        inset: 0,
                        pointerEvents: "none",
                        position: "absolute",
                    }}
                >
                    {getComponent(stickyHeaderConfig.backdropComponent)}
                </div>
            ) : null,
        [stickyHeaderConfig?.backdropComponent],
    );

    return (
        <div ref={refView as unknown as React.RefObject<HTMLDivElement>} style={viewStyle as any} {...webProps}>
            {renderStickyHeaderBackdrop}
            {children}
        </div>
    );
});

export const PositionView = PositionViewState;
