import { LegendList as LegendListBase, type LegendListProps, type LegendListRef } from "@legendapp/list";
import type { AnimatedLegendList } from "@legendapp/list/animated";
import type { AnimatedLegendList as ReanimatedLegendList } from "@legendapp/list/reanimated";
// biome-ignore lint/style/useImportType: Leaving this out makes it crash in some environments
import * as React from "react";
import { type ForwardedRef, forwardRef, useRef, useState } from "react";
import { Animated, type Insets, Keyboard, StyleSheet } from "react-native";
import { useKeyboardAnimation } from "react-native-keyboard-controller";

// biome-ignore lint/complexity/noBannedTypes: This is a workaround for the fact that forwardRef is not typed
type TypedForwardRef = <T, P = {}>(
    render: (props: P, ref: React.Ref<T>) => React.ReactNode,
) => (props: P & React.RefAttributes<T>) => React.ReactNode;

const typedForwardRef = forwardRef as TypedForwardRef;

export const LegendList = typedForwardRef(function LegendList<
    ItemT,
    ListT extends
        | typeof LegendListBase
        | typeof AnimatedLegendList
        | typeof ReanimatedLegendList = typeof LegendListBase,
>(props: LegendListProps<ItemT> & { LegendList?: ListT }, forwardedRef: ForwardedRef<LegendListRef>) {
    const {
        LegendList: LegendListProp,
        contentContainerStyle: contentContainerStyleProp,
        scrollIndicatorInsets: scrollIndicatorInsetsProp,
        ...rest
    } = props;
    const ref = useRef<LegendListRef>(null);
    const [padding, setPadding] = useState(0);

    // Define this function outside the worklet
    // const updatePadding = (height: number) => {
    //     setPadding(height);
    // };

    // useKeyboardHandler({
    //     onEnd: (e) => {
    //         "worklet";
    //         runOnJS(updatePadding)(e.height);
    //     },
    // });

    const updateAnchorOffset = (height: number) => {
        console.log("updateAnchorOffset", height);
        ref.current?.setVisibleContentAnchorOffset((v) => height);
    };

    const { height } = useKeyboardAnimation();
    // React.useEffect(() => {
    //     height.addListener((e) => {
    //         console.log("height", e.value);
    //         updateAnchorOffset(-e.value);
    //     });
    // }, []);

    // useAnimatedReaction(
    //     () => progress,
    //     (height) => {
    //         "worklet";
    //         runOnJS(updateAnchorOffset)(progress.v);
    //     },
    // );

    React.useEffect(() => {
        let wasAtEndOnStart = false;
        const keyboardWillShow = Keyboard.addListener("keyboardWillShow", (e) => {
            console.log("keyboardDidShow", e.endCoordinates.height);
            const state = ref.current?.getState();
            wasAtEndOnStart = !!state?.isAtEnd;
            // updatePadding(e.endCoordinates.height);

            // ref.current?.animateVisibleContentAnchorOffset((v) =>
            //     Animated.timing(v, {
            //         toValue: e.endCoordinates.height,
            //         duration: 300,
            //         useNativeDriver: false,
            //     }).start(),
            // );
        });
        const keyboardDidShow = Keyboard.addListener("keyboardDidShow", (e) => {
            console.log("keyboardDidShow", e.endCoordinates.height, wasAtEndOnStart);
            if (wasAtEndOnStart) {
                ref.current?.scrollToEnd({ animated: true });
            }
        });
        const keyboardWillHide = Keyboard.addListener("keyboardWillHide", (e) => {
            console.log("keyboardWillHide", e.endCoordinates.height);
            const state = ref.current?.getState();
            if (state?.isAtStart) {
                // updatePadding(0);
                // ref.current?.scrollToIndex({ index: 0, animated: true });
            }
            // ref.current?.animateVisibleContentAnchorOffset((v) =>
            //     Animated.timing(v, {
            //         toValue: e.endCoordinates.height,
            //         duration: 300,
            //         useNativeDriver: true,
            //     }).start(),
            // );
        });
        const keyboardDidHide = Keyboard.addListener("keyboardDidHide", (e) => {
            console.log("keyboardDidHide", e.endCoordinates.height);
            const state = ref.current?.getState();
            if (!state?.isAtStart) {
                // updatePadding(0);
                // ref.current?.scrollToIndex({ index: 0, animated: true });
            }
            // updatePadding(0);
            // ref.current?.scrollToIndex({ index: 0, animated: false });
        });
        return () => {
            keyboardWillShow.remove();
            keyboardDidShow.remove();
            keyboardWillHide.remove();
            keyboardDidHide.remove();
        };
    }, []);

    const LegendListComponent = LegendListProp ?? LegendListBase;

    const contentContainerStyleFlattened = StyleSheet.flatten(contentContainerStyleProp) || {};
    const contentContainerStyle = { ...contentContainerStyleFlattened, paddingTop: padding };
    const scrollIndicatorInsets: Insets = scrollIndicatorInsetsProp ? { ...scrollIndicatorInsetsProp } : {};
    if (!props.horizontal) {
        scrollIndicatorInsets.top = (scrollIndicatorInsets?.top || 0) + padding;
    }

    return (
        <Animated.View style={{ flex: 1 }}>
            {/* @ts-expect-error TODO: Fix this type */}
            <LegendListComponent
                {...rest}
                contentContainerStyle={contentContainerStyle}
                scrollIndicatorInsets={scrollIndicatorInsets}
                ref={ref}
            />
        </Animated.View>
    );
});
