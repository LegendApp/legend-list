// code borrowed from react-native https://github.com/facebook/react-native/blob/main/packages/react-native/Libraries/Components/ScrollView/ScrollViewStickyHeader.js
// what minimum RN version is required for this to work?

import React, { useCallback, useRef, useEffect, useMemo, useState, forwardRef } from "react";
import { Animated, type LayoutChangeEvent, Platform, StyleSheet } from "react-native";
import { use$ } from "../state";
import { useRenderItem } from "./RenderItemContext";
import { useMergeRefs } from "./utils";

const fabricEnabled = global?.nativeFabricUIManager != null;

interface Props {
    children?: React.ReactElement;
    nextHeaderLayoutY?: number | null;
    onLayout: (event: LayoutChangeEvent) => void;
    scrollAnimatedValue: Animated.Value;
    inverted?: boolean | null;
    scrollViewHeight?: number | null;
    nativeID?: string | null;
    hiddenOnScroll?: boolean | null;
}

interface Instance extends React.ElementRef<typeof Animated> {
    setNextHeaderY: (value: number | null) => void;
}

export const ScrollViewStickyHeaderWithForwardedRef = forwardRef<Instance, Props>((props, forwardedRef) => {
    const {
        inverted,
        scrollViewHeight,
        hiddenOnScroll,
        scrollAnimatedValue,
        nextHeaderLayoutY: _nextHeaderLayoutY,
    } = props;

    const [measured, setMeasured] = useState<boolean>(false);
    const [layoutY, setLayoutY] = useState<number>(0);
    const [layoutHeight, setLayoutHeight] = useState<number>(0);
    const [translateY, setTranslateY] = useState<number>(null);
    const [nextHeaderLayoutY, setNextHeaderLayoutY] = useState<number>(_nextHeaderLayoutY);
    const [isFabric, setIsFabric] = useState<boolean>(false);

    const callbackRef = useCallback((ref: Instance | null): void => {
        if (ref == null) {
            return;
        }
        ref.setNextHeaderY = setNextHeaderLayoutY;
        setIsFabric(fabricEnabled);
    }, []);
    const ref: React.RefSetter<React.ElementRef<typeof Animated.View>> =
        // $FlowFixMe[prop-missing] - Instance is mutated to have `setNextHeaderY`.
        useMergeRefs<Instance>(callbackRef, forwardedRef);

    const offset = useMemo(
        () =>
            hiddenOnScroll === true
                ? Animated.diffClamp(
                      scrollAnimatedValue
                          .interpolate({
                              extrapolateLeft: "clamp",
                              inputRange: [layoutY, layoutY + 1],
                              outputRange: [0, 1],
                          })
                          .interpolate({
                              inputRange: [0, 1],
                              outputRange: [0, -1],
                          }),
                      -layoutHeight,
                      0,
                  )
                : null,
        [scrollAnimatedValue, layoutHeight, layoutY, hiddenOnScroll],
    );

    const [animatedTranslateY, setAnimatedTranslateY] = useState<Animated.Node>(() => {
        const inputRange: Array<number> = [-1, 0];
        const outputRange: Array<number> = [0, 0];
        const initialTranslateY = scrollAnimatedValue.interpolate({
            inputRange,
            outputRange,
        });

        if (offset != null) {
            return Animated.add(initialTranslateY, offset);
        }
        return initialTranslateY;
    });

    const haveReceivedInitialZeroTranslateY = useRef<boolean>(true);
    const translateYDebounceTimer = useRef<TimeoutID>(null);

    useEffect(() => {
        if (translateY !== 0 && translateY != null) {
            haveReceivedInitialZeroTranslateY.current = false;
        }
    }, [translateY]);

    // This is called whenever the (Interpolated) Animated Value
    // updates, which is several times per frame during scrolling.
    // To ensure that the Fabric ShadowTree has the most recent
    // translate style of this node, we debounce the value and then
    // pass it through to the underlying node during render.
    // This is:
    // 1. Only an issue in Fabric.
    // 2. Worse in Android than iOS. In Android, but not iOS, you
    //    can touch and move your finger slightly and still trigger
    //    a "tap" event. In iOS, moving will cancel the tap in
    //    both Fabric and non-Fabric. On Android when you move
    //    your finger, the hit-detection moves from the Android
    //    platform to JS, so we need the ShadowTree to have knowledge
    //    of the current position.
    const animatedValueListener = useCallback(({ value }: any) => {
        const debounceTimeout: number = Platform.OS === "android" ? 15 : 64;
        // When the AnimatedInterpolation is recreated, it always initializes
        // to a value of zero and emits a value change of 0 to its listeners.
        if (value === 0 && !haveReceivedInitialZeroTranslateY.current) {
            haveReceivedInitialZeroTranslateY.current = true;
            return;
        }
        if (translateYDebounceTimer.current != null) {
            clearTimeout(translateYDebounceTimer.current);
        }
        translateYDebounceTimer.current = setTimeout(() => setTranslateY(value), debounceTimeout);
    }, []);

    useEffect(() => {
        const inputRange: Array<number> = [-1, 0];
        const outputRange: Array<number> = [0, 0];

        if (measured) {
            if (inverted === true) {
                // The interpolation looks like:
                // - Negative scroll: no translation
                // - `stickStartPoint` is the point at which the header will start sticking.
                //   It is calculated using the ScrollView viewport height so it is a the bottom.
                // - Headers that are in the initial viewport will never stick, `stickStartPoint`
                //   will be negative.
                // - From 0 to `stickStartPoint` no translation. This will cause the header
                //   to scroll normally until it reaches the top of the scroll view.
                // - From `stickStartPoint` to when the next header y hits the bottom edge of the header: translate
                //   equally to scroll. This will cause the header to stay at the top of the scroll view.
                // - Past the collision with the next header y: no more translation. This will cause the
                //   header to continue scrolling up and make room for the next sticky header.
                //   In the case that there is no next header just translate equally to
                //   scroll indefinitely.
                if (scrollViewHeight != null) {
                    const stickStartPoint = layoutY + layoutHeight - scrollViewHeight;
                    if (stickStartPoint > 0) {
                        inputRange.push(stickStartPoint);
                        outputRange.push(0);
                        inputRange.push(stickStartPoint + 1);
                        outputRange.push(1);
                        // If the next sticky header has not loaded yet (probably windowing) or is the last
                        // we can just keep it sticked forever.
                        const collisionPoint = (nextHeaderLayoutY || 0) - layoutHeight - scrollViewHeight;
                        if (collisionPoint > stickStartPoint) {
                            inputRange.push(collisionPoint, collisionPoint + 1);
                            outputRange.push(collisionPoint - stickStartPoint, collisionPoint - stickStartPoint);
                        }
                    }
                }
            } else {
                // The interpolation looks like:
                // - Negative scroll: no translation
                // - From 0 to the y of the header: no translation. This will cause the header
                //   to scroll normally until it reaches the top of the scroll view.
                // - From header y to when the next header y hits the bottom edge of the header: translate
                //   equally to scroll. This will cause the header to stay at the top of the scroll view.
                // - Past the collision with the next header y: no more translation. This will cause the
                //   header to continue scrolling up and make room for the next sticky header.
                //   In the case that there is no next header just translate equally to
                //   scroll indefinitely.
                inputRange.push(layoutY);
                outputRange.push(0);
                // If the next sticky header has not loaded yet (probably windowing) or is the last
                // we can just keep it sticked forever.
                const collisionPoint = (nextHeaderLayoutY || 0) - layoutHeight;
                if (collisionPoint >= layoutY) {
                    inputRange.push(collisionPoint, collisionPoint + 1);
                    outputRange.push(collisionPoint - layoutY, collisionPoint - layoutY);
                } else {
                    inputRange.push(layoutY + 1);
                    outputRange.push(1);
                }
            }
        }

        let newAnimatedTranslateY: Animated.Node = scrollAnimatedValue.interpolate({
            inputRange,
            outputRange,
        });

        if (offset != null) {
            newAnimatedTranslateY = Animated.add(newAnimatedTranslateY, offset);
        }

        // add the event listener
        let animatedListenerId;
        if (isFabric) {
            animatedListenerId = newAnimatedTranslateY.addListener(animatedValueListener);
        }

        setAnimatedTranslateY(newAnimatedTranslateY);

        // clean up the event listener and timer
        return () => {
            if (animatedListenerId) {
                newAnimatedTranslateY.removeListener(animatedListenerId);
            }
            if (translateYDebounceTimer.current != null) {
                clearTimeout(translateYDebounceTimer.current);
            }
        };
    }, [
        nextHeaderLayoutY,
        measured,
        layoutHeight,
        layoutY,
        scrollViewHeight,
        scrollAnimatedValue,
        inverted,
        offset,
        animatedValueListener,
        isFabric,
    ]);

    const _onLayout = (event: LayoutEvent) => {
        setLayoutY(event.nativeEvent.layout.y);
        setLayoutHeight(event.nativeEvent.layout.height);
        setMeasured(true);

        props.onLayout(event);
        const child = React.Children.only<any>(props.children);
        if (child.props.onLayout) {
            child.props.onLayout(event);
        }
    };

    const sticky = use$<string | undefined>("currentStickyHeaderKey");
    const renderItem = useRenderItem();
    const renderedItem = useMemo(() => sticky !== undefined && renderItem(sticky, 0), [sticky]);

    const passthroughAnimatedPropExplicitValues =
        isFabric && translateY != null
            ? {
                  style: { transform: [{ translateY: translateY }] },
              }
            : null;

    return (
        <Animated.View
            key={"sticky"}
            collapsable={false}
            nativeID={props.nativeID}
            onLayout={_onLayout}
            /* $FlowFixMe[prop-missing] passthroughAnimatedPropExplicitValues isn't properly
                 included in the Animated.View flow type. */
            ref={ref}
            style={[styles.header, { transform: [{ translateY: animatedTranslateY }] }]}
            passthroughAnimatedPropExplicitValues={passthroughAnimatedPropExplicitValues}
        >
            {renderedItem}
        </Animated.View>
    );
});

const styles = StyleSheet.create({
    header: {
        zIndex: 10,
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
    },
    fill: {
        flex: 1,
    },
});

ScrollViewStickyHeaderWithForwardedRef;
