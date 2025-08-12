import type { CSSProperties } from "react";
import * as React from "react";

import { LeanView } from "@/components/LeanView";
import { ENABLE_DOM_REORDER, POSITION_OUT_OF_VIEW } from "@/constants";
import type { LayoutChangeEvent } from "@/platform/Layout";
import { Platform } from "@/platform/Platform";
import type { ViewStyle, WebViewMethods } from "@/platform/View";
import { listen$, useArr$, useStateContext } from "@/state/state";
import { typedMemo } from "@/types";
import { sortDOMElementsPatience } from "@/utils/reordering";

const reorderElementsInDOM = (element: HTMLDivElement) => {
    if (Platform.OS !== "web" || !ENABLE_DOM_REORDER) return;

    const parent = element.parentElement;
    if (!parent) return;

    return sortDOMElementsPatience(parent as HTMLDivElement);

    // const index = +element.getAttribute("index")!;
    // console.log("index", index);
    // const items = element.parentElement?.children;

    // let nextSibling = items[0] as HTMLDivElement;

    // while (nextSibling) {
    //     const nextIndexStr = nextSibling.getAttribute("index")!;
    //     if (nextIndexStr === null) {
    //         const nextIndex = +nextIndexStr;
    //         if (nextSibling !== element) {
    //             if (nextIndex === index - 1) {
    //                 console.log("insert after", nextIndex, index);
    //                 nextSibling.insertAdjacentElement("afterend", element);
    //                 break;
    //             } else if (nextIndex === index + 1) {
    //                 console.log("insert before", index, nextIndex);
    //                 parent.insertBefore(element, nextSibling);
    //                 break;
    //             }
    //         }
    //     }
    //     nextSibling = nextSibling.nextSibling as HTMLDivElement;
    // }
    // const items2 = element.parentElement?.children;
    // nextSibling = items2[0] as HTMLDivElement;
    // let prevIndex = parseInt(nextSibling.getAttribute("index")!);
    // nextSibling = nextSibling.nextSibling as HTMLDivElement;
    // while (nextSibling) {
    //     const nextIndexStr = nextSibling.getAttribute("index")!;
    //     if (nextIndexStr !== null) {
    //         const nextIndex = parseInt(nextIndexStr);
    //         if (nextIndex < prevIndex) {
    //             debugger;
    //         }
    //         prevIndex = nextIndex;
    //     }
    //     nextSibling = nextSibling.nextSibling as HTMLDivElement;
    // }
};

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
    const ctx = useStateContext();
    const [position = POSITION_OUT_OF_VIEW] = useArr$([`containerPosition${id}`]);

    React.useEffect(() => {
        return listen$(ctx, `containerItemKey${id}`, () => {
            requestAnimationFrame(() => {
                reorderElementsInDOM(refView.current!);
            });
        });
    }, []);

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
