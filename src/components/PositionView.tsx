import * as React from "react";

import { LeanView } from "@/components/LeanView";
import { IsNewArchitecture, POSITION_OUT_OF_VIEW } from "@/constants";
import { useValue$ } from "@/hooks/useValue$";
import { Animated, type AnimatedValue } from "@/platform/Animated";
import type { LayoutChangeEvent } from "@/platform/Layout";
import { Platform } from "@/platform/Platform";
import type { ViewStyle, WebViewMethods } from "@/platform/View";
import { useArr$ } from "@/state/state";
import { typedMemo } from "@/types";

// Web-specific DOM reordering utilities
const domOrderingMap = new WeakMap<HTMLDivElement, number>();

const reorderElementsInDOM = (element: HTMLDivElement, position: number, horizontal: boolean) => {
    if (Platform.OS !== "web") return;

    const parent = element.parentElement;
    if (!parent) return;

    // Get all positioned container children
    const containers = Array.from(parent.children)
        .filter((child): child is HTMLDivElement => {
            const style = window.getComputedStyle(child);
            return style.position === "absolute" && child instanceof HTMLDivElement;
        })
        .map((child: HTMLDivElement) => {
            const cachedPos = domOrderingMap.get(child);
            return {
                element: child,
                position: cachedPos ?? (horizontal ? 0 : 0), // Will be updated by individual containers
            };
        })
        .filter((c) => c.position !== undefined)
        .sort((a, b) => a.position - b.position);

    // Only reorder if we have multiple containers with different positions
    if (containers.length < 2) return;

    // Use insertBefore to reorder elements
    for (let i = 0; i < containers.length; i++) {
        const { element: containerElement } = containers[i];
        const currentIndex = Array.from(parent.children).indexOf(containerElement);

        if (currentIndex !== i) {
            const nextSibling = parent.children[i];
            if (nextSibling && nextSibling !== containerElement) {
                parent.insertBefore(containerElement, nextSibling);
            }
        }
    }
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
        if (Platform.OS === "web" && refView.current && position > POSITION_OUT_OF_VIEW) {
            domOrderingMap.set(refView.current, position);

            // Schedule reordering after render
            requestAnimationFrame(() => {
                reorderElementsInDOM(refView.current!, position, horizontal);
            });
        }
    }, [position, horizontal, id]);

    return (
        <LeanView
            ref={refView}
            style={[
                style,
                horizontal ? { transform: [{ translateX: position }] } : { transform: [{ translateY: position }] },
            ]}
            {...rest}
        />
    );
});

// The Animated version is better on old arch but worse on new arch.
// And we don't want to use on new arch because it would make position updates
// not synchronous with the rest of the state updates.
const PositionViewAnimated = typedMemo(function PositionView({
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
    const position$ = useValue$(`containerPosition${id}`, {
        getValue: (v) => v ?? POSITION_OUT_OF_VIEW,
    });

    // For animated version, we need to track position changes differently
    const [currentPosition, setCurrentPosition] = React.useState(POSITION_OUT_OF_VIEW);

    React.useEffect(() => {
        // Listen to position$ changes
        const listenerId = position$.addListener(({ value }) => {
            setCurrentPosition(value);

            if (Platform.OS === "web" && refView.current && value > POSITION_OUT_OF_VIEW) {
                domOrderingMap.set(refView.current, value);

                // Schedule reordering after render
                requestAnimationFrame(() => {
                    reorderElementsInDOM(refView.current!, value, horizontal);
                });
            }
        });

        return () => position$.removeListener(listenerId);
    }, [id, horizontal, position$]);

    return (
        <Animated.View
            ref={refView}
            style={[
                style,
                horizontal ? { transform: [{ translateX: position$ }] } : { transform: [{ translateY: position$ }] },
            ]}
            {...rest}
        />
    );
});

// The Animated version is better on old arch but worse on new arch.
// And we don't want to use on new arch because it would make position updates
// not synchronous with the rest of the state updates.
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
    animatedScrollY?: AnimatedValue;
    stickyOffset?: AnimatedValue;
    onLayout: (event: LayoutChangeEvent) => void;
    index: number;
    children: React.ReactNode;
}) {
    const [position = POSITION_OUT_OF_VIEW] = useArr$([`containerPosition${id}`]);

    // Calculate transform based on sticky state
    const transform = React.useMemo(() => {
        if (animatedScrollY && stickyOffset) {
            const stickyPosition = animatedScrollY.interpolate({
                extrapolate: "clamp",
                inputRange: [position, position + 5000],
                outputRange: [position, position + 5000],
            });

            return horizontal ? [{ translateX: stickyPosition }] : [{ translateY: stickyPosition }];
        }
    }, [position, horizontal, animatedScrollY, stickyOffset]);

    const viewStyle = React.useMemo(() => [style, { zIndex: index + 1000 }, { transform }], [style, transform]);

    return <Animated.View ref={refView} style={viewStyle} {...rest} />;
});

export const PositionView = IsNewArchitecture ? PositionViewState : PositionViewAnimated;
export { PositionViewSticky };
