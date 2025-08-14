import type { CSSProperties } from "react";
import * as React from "react";

import { LeanView } from "@/components/LeanView";
import { POSITION_OUT_OF_VIEW } from "@/constants";
import type { LayoutChangeEvent } from "@/platform/Layout";
import type { ViewStyle, WebViewMethods } from "@/platform/View";
import { useArr$ } from "@/state/state";
import { typedMemo } from "@/types";

const PositionViewState = typedMemo(function PositionView({
    id,
    horizontal,
    style,
    refView,
    ...rest
}: {
    id: number;
    horizontal: boolean;
    style: ViewStyle | ViewStyle[];
    refView: React.RefObject<HTMLDivElement & WebViewMethods>;
    onLayout: (event: LayoutChangeEvent) => void;
    children: React.ReactNode;
}) {
    const [position = POSITION_OUT_OF_VIEW] = useArr$([`containerPosition${id}`]);

    // Merge to a single CSSProperties object and avoid RN-style transform arrays
    const base: CSSProperties = Array.isArray(style)
        ? (Object.assign({}, ...style) as CSSProperties)
        : (style as unknown as CSSProperties);
    const combinedStyle: CSSProperties = horizontal
        ? ({ ...base, left: position } as CSSProperties)
        : ({ ...base, top: position } as CSSProperties);

    // Avoid global observeLayout per container; rely on child item onLayout, or enable selectively for sticky
    return <LeanView ref={refView} style={combinedStyle as any} {...rest} />;
});

export const PositionViewSticky = typedMemo(function PositionViewSticky({
    id,
    horizontal,
    style,
    refView,
    index,
    ...rest
}: {
    id: number;
    horizontal: boolean;
    style: ViewStyle | ViewStyle[];
    refView: React.RefObject<HTMLDivElement & WebViewMethods>;
    onLayout: (event: LayoutChangeEvent) => void;
    index: number;
    children: React.ReactNode;
}) {
    const [position = POSITION_OUT_OF_VIEW] = useArr$([`containerPosition${id}`]);

    const viewStyle = React.useMemo(() => {
        const base: CSSProperties = Array.isArray(style)
            ? (Object.assign({}, ...style) as CSSProperties)
            : (style as unknown as CSSProperties);
        const axisStyle: CSSProperties = horizontal
            ? ({ transform: `translateX(${position}px)` } as CSSProperties)
            : ({ top: position } as CSSProperties);
        return {
            ...base,
            zIndex: index + 1000,
            ...axisStyle,
        } as CSSProperties;
    }, [style, position, horizontal, index]);

    // Update DOM ordering on web when position changes
    // React.useLayoutEffect(() => {
    //     if (Platform.OS === "web" && ENABLE_DOM_REORDER && refView.current && position > POSITION_OUT_OF_VIEW) {
    //         domOrderingMap.set(refView.current, position);

    //         // Schedule reordering after render
    //         requestAnimationFrame(() => {
    //             reorderElementsInDOM(refView.current!);
    //         });
    //     }
    // }, [position, horizontal, id]);

    // Sticky needs more accurate sizing; still avoid default observeLayout here
    return <LeanView ref={refView} style={viewStyle as any} {...rest} />;
});

export const PositionView = PositionViewState;
