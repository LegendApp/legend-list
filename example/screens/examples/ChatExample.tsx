import { MaterialIcons } from "@expo/vector-icons";
import { useRef } from "react";
import { Pressable, StyleSheet, type ViewProps } from "react-native";
import { KeyboardGestureArea, KeyboardProvider, KeyboardStickyView } from "react-native-keyboard-controller";
import Animated, { useAnimatedProps, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { KeyboardAwareLegendList } from "@legendapp/list/keyboard";
import type { LegendListRef } from "@legendapp/list/react-native";
import { ChatComposer, getChatListProps, useChatExample } from "./chatShared";
import { SafeAreaShell } from "./shared";

export function ChatExample() {
    const listRef = useRef<LegendListRef>(null);
    const insets = useSafeAreaInsets();
    const isNearEnd = useSharedValue(true);
    const { input, messages, sendMessage, setInput } = useChatExample();
    const scrollToEndButtonStyle = useAnimatedStyle(() => ({
        opacity: withTiming(isNearEnd.value ? 0 : 1, { duration: 160 }),
    }));
    const scrollToEndButtonProps = useAnimatedProps<ViewProps>(() => ({
        pointerEvents: isNearEnd.value ? "none" : "auto",
    }));
    const listProps = getChatListProps({ messages });

    return (
        <KeyboardProvider>
            <SafeAreaShell>
                <KeyboardGestureArea interpolator="ios" offset={60} style={{ flex: 1 }}>
                    <KeyboardAwareLegendList
                        keyboardDismissMode="interactive"
                        keyboardOffset={insets.bottom}
                        ref={listRef}
                        sharedValues={{ isNearEnd }}
                        style={{ flex: 1 }}
                        {...listProps}
                    />
                    <Animated.View
                        animatedProps={scrollToEndButtonProps}
                        style={[styles.scrollToEndButtonWrap, scrollToEndButtonStyle]}
                    >
                        <Pressable
                            accessibilityLabel="Scroll to end"
                            onPress={() => listRef.current?.scrollToEnd({ animated: true })}
                            style={styles.scrollToEndButton}
                        >
                            <MaterialIcons color="#FFFFFF" name="keyboard-arrow-down" size={28} />
                        </Pressable>
                    </Animated.View>
                </KeyboardGestureArea>
                <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>
                    <ChatComposer
                        input={input}
                        onChangeText={setInput}
                        onPress={() => sendMessage(input)}
                        placeholder="Type a message"
                    />
                </KeyboardStickyView>
            </SafeAreaShell>
        </KeyboardProvider>
    );
}

const styles = StyleSheet.create({
    scrollToEndButton: {
        alignItems: "center",
        backgroundColor: "#111827",
        borderRadius: 999,
        height: 44,
        justifyContent: "center",
        width: 44,
    },
    scrollToEndButtonWrap: {
        bottom: 18,
        position: "absolute",
        right: 18,
    },
});
