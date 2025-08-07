import * as React from "react";

import { LeanView } from "@/components/LeanView";
import { ENABLE_DOM_REORDER, POSITION_OUT_OF_VIEW } from "@/constants";
import type { LayoutChangeEvent } from "@/platform/Layout";
import { Platform } from "@/platform/Platform";
import type { ViewStyle, WebViewMethods } from "@/platform/View";
import { useArr$ } from "@/state/state";
import { typedMemo } from "@/types";

// Web-specific DOM reordering utilities
const domOrderingMap = new WeakMap<HTMLDivElement, number>();

const reorderElementsInDOM = (element: HTMLDivElement, newPosition: number) => {
    if (Platform.OS !== "web" || !ENABLE_DOM_REORDER) return;

    const parent = element.parentElement;
    if (!parent) return;

    // Get all positioned containers with their positions
    const containerPositions = Array.from(parent.children)
        .filter((child): child is HTMLDivElement => domOrderingMap.has(child as HTMLDivElement))
        .map((child) => ({
            element: child as HTMLDivElement,
            position: domOrderingMap.get(child as HTMLDivElement)!,
        }))
        .sort((a, b) => a.position - b.position);

    // Only reorder if we have multiple containers
    if (containerPositions.length < 2) return;

    // Find where this element should be inserted in the sorted order
    let insertBeforeElement: HTMLDivElement | null = null;

    for (const container of containerPositions) {
        if (container.element === element) {
            continue; // Skip the element we're moving
        }

        if (container.position > newPosition) {
            insertBeforeElement = container.element;
            break;
        }
    }

    // Check if the element is already in the correct position
    const currentNextSibling = element.nextElementSibling;
    if (currentNextSibling === insertBeforeElement) {
        return; // Already in correct position
    }

    // Perform the DOM reordering
    parent.insertBefore(element, insertBeforeElement);
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
    const [position = POSITION_OUT_OF_VIEW] = useArr$([`containerPosition${id}`]);

    // Update DOM ordering on web when position changes
    React.useLayoutEffect(() => {
        if (Platform.OS === "web" && ENABLE_DOM_REORDER && refView.current && position > POSITION_OUT_OF_VIEW) {
            domOrderingMap.set(refView.current, position);

            // Schedule reordering after render
            requestAnimationFrame(() => {
                reorderElementsInDOM(refView.current!, position);
            });
        }
    }, [position, horizontal, id]);

    const baseStyleArray: ViewStyle[] = Array.isArray(style) ? style : [style];
    const combinedStyle: ViewStyle[] = [
        ...baseStyleArray,
        { willChange: "transform" as any },
        horizontal
            ? ({ transform: [{ translateX: position }] } as ViewStyle)
            : ({ transform: [{ translateY: position }] } as ViewStyle),
    ];

    return <LeanView observeLayout ref={refView} style={combinedStyle} {...rest} />;
});

const PositionViewSticky = typedMemo(function PositionViewSticky({
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
        const base: ViewStyle[] = Array.isArray(style) ? style : [style];
        const transformStyle: ViewStyle = horizontal
            ? ({ transform: [{ translateX: position }] } as ViewStyle)
            : ({ transform: [{ translateY: position }] } as ViewStyle);
        return [
            ...base,
            { zIndex: index + 1000 } as ViewStyle,
            { willChange: "transform" as any } as ViewStyle,
            transformStyle,
        ];
    }, [style, position, horizontal, index]);

    // Update DOM ordering on web when position changes
    React.useLayoutEffect(() => {
        if (Platform.OS === "web" && ENABLE_DOM_REORDER && refView.current && position > POSITION_OUT_OF_VIEW) {
            domOrderingMap.set(refView.current, position);

            // Schedule reordering after render
            requestAnimationFrame(() => {
                reorderElementsInDOM(refView.current!, position);
            });
        }
    }, [position, horizontal, id]);

    return <LeanView observeLayout ref={refView} style={viewStyle} {...rest} />;
});

export const PositionView = PositionViewState;
export { PositionViewSticky };
