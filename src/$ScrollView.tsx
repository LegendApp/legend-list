import { forwardRef } from "react";
// biome-ignore lint/correctness/noUnusedImports: Example crashes if React is missing for some reason
import { Platform, ScrollView, type ScrollViewProps, StyleSheet, type ViewProps } from "react-native";
import { use$ } from "./state";

// A component that listens to a signal and updates its style based on the signal.
// This is a performance optimization to avoid unnecessary renders because it doesn't need to re-render the entire component.
export const $ScrollView = forwardRef(function $ScrollView(props: ScrollViewProps, ref: React.Ref<ScrollView>) {
    const { style, ...rest } = props;
    // Re-render whenever scrollAdjust changes
    const scrollAdjust = use$<number>("scrollAdjust");
    return (
        <ScrollView
            {...rest}
            style={StyleSheet.compose(props.style, Platform.OS === "ios" ? {} : { marginTop: -(scrollAdjust || 0) })}
            contentInset={Platform.OS === "ios" ? { top: -scrollAdjust || 0 } : undefined}
            ref={ref}
        />
    );
});
