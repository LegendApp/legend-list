import { MaterialIcons } from "@expo/vector-icons";
import { useCallback, useRef } from "react";
import { Pressable, StyleSheet, type ViewProps } from "react-native";
import {
    KeyboardController,
    KeyboardGestureArea,
    KeyboardProvider,
    KeyboardStickyView,
} from "react-native-keyboard-controller";
import Animated, { useAnimatedProps, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { KeyboardChatLegendList } from "@legendapp/list/keyboard-chat";
import type { LegendListRef } from "@legendapp/list/react-native";
import { ChatComposer, getAiChatListProps, useAiChatExample } from "./chatShared";
import { SafeAreaShell } from "./shared";

export function AiChatExample() {
    const listRef = useRef<LegendListRef>(null);
    const insets = useSafeAreaInsets();
    const freeze = useSharedValue(false);
    const isNearEnd = useSharedValue(true);

    const scrollToEndButtonStyle = useAnimatedStyle(() => ({
        opacity: withTiming(isNearEnd.value ? 0 : 1, { duration: 160 }),
    }));
    const scrollToEndButtonProps = useAnimatedProps<ViewProps>(() => ({
        pointerEvents: isNearEnd.value ? "none" : "auto",
    }));

    const beforeScrollToEnd = useCallback(() => {
        freeze.set(true);
        return KeyboardController.dismiss();
    }, [freeze]);
    const afterScrollToEnd = useCallback(() => {
        freeze.set(false);
    }, [freeze]);
    const scrollToEnd = useCallback(() => {
        listRef.current?.scrollToEnd({ animated: true });
    }, []);
    const { anchorIndex, input, messages, sendPrompt, setInput } = useAiChatExample({
        afterScrollToEnd,
        beforeScrollToEnd,
        listRef,
        streamIntervalMs: 5,
        streamStartDelayMs: 1000,
    });
    const listProps = getAiChatListProps({ anchorIndex, messages });

    return (
        <KeyboardProvider>
            <SafeAreaShell>
                <KeyboardGestureArea interpolator="ios" offset={60} style={{ flex: 1 }}>
                    <KeyboardChatLegendList
                        freeze={freeze}
                        keyboardDismissMode="interactive"
                        offset={insets.bottom}
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
                            onPress={scrollToEnd}
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
                        onPress={() => sendPrompt(input)}
                        placeholder="Ask about list behavior"
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
