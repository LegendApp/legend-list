import type { CSSProperties } from "react";
import * as React from "react";

import { POSITION_OUT_OF_VIEW } from "@/constants";
import type { LayoutRectangle } from "@/platform/platform-types";
import { useArr$ } from "@/state/state";
import { typedMemo } from "@/types";
import { isArray } from "@/utils/helpers";

interface ExtraPropsFromRN {
    animatedScrollY: any;
    onLayout: any;
    stickyOffset: any;
}

interface PositionViewStateProps {
    id: number;
    horizontal: boolean;
    style: CSSProperties;
    refView: React.RefObject<HTMLDivElement>;
    onLayoutChange: (rectangle: LayoutRectangle, fromLayoutEffect: boolean) => void;
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
    const { animatedScrollY, stickyOffset, onLayout, ...webProps } = props as PositionViewStateProps & ExtraPropsFromRN;

    return <div ref={refView} {...(webProps as any)} style={combinedStyle as any} />;
});

// biome-ignore lint/nursery/noShadow: const function name shadowing is intentional
export const PositionViewSticky = typedMemo(function PositionViewSticky({
    id,
    horizontal,
    style,
    refView,
    index,
    stickyOffset,
    animatedScrollY: _animatedScrollY,
    children,
    ...rest
}: {
    id: number;
    horizontal: boolean;
    style: CSSProperties;
    refView: React.RefObject<HTMLDivElement>;
    onLayoutChange: (rectangle: LayoutRectangle, fromLayoutEffect: boolean) => void;
    index: number;
    stickyOffset?: number;
    animatedScrollY?: unknown;
    children: React.ReactNode;
}) {
    const [position = POSITION_OUT_OF_VIEW, headerSize = 0, activeStickyIndex] = useArr$([
        `containerPosition${id}`,
        "headerSize",
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

        const offset = stickyOffset ?? headerSize ?? 0;
        const isActive = activeStickyIndex === index;
        styleBase.position = isActive ? "sticky" : "absolute";
        styleBase.zIndex = index + 1000;

        if (horizontal) {
            styleBase.left = isActive ? offset : position;
        } else {
            styleBase.top = isActive ? offset : position;
        }

        return styleBase;
    }, [composed, horizontal, position, index, stickyOffset, headerSize, activeStickyIndex]);

    return (
        <div ref={refView} style={viewStyle as any} {...rest}>
            {children}
        </div>
    );
});

export const PositionView = PositionViewState;
