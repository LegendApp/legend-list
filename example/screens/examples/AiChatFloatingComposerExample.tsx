import { MaterialIcons } from "@expo/vector-icons";
import { useCallback, useRef, useState } from "react";
import {
    type NativeSyntheticEvent,
    Platform,
    Pressable,
    StyleSheet,
    TextInput,
    type TextInputContentSizeChangeEventData,
    View,
} from "react-native";
import {
    KeyboardGestureArea,
    KeyboardProvider,
    KeyboardStickyView,
    useReanimatedKeyboardAnimation,
} from "react-native-keyboard-controller";
import Animated, { type SharedValue, useAnimatedStyle } from "react-native-reanimated";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import {
    KeyboardChatLegendList,
    useKeyboardChatComposerInset,
    useKeyboardScrollToEnd,
} from "@legendapp/list/keyboard-chat";
import type { LegendListRef } from "@legendapp/list/react-native";
import { isLiquidGlassSupported, LiquidGlassView } from "@callstack/liquid-glass";
import { getAiChatListProps, useAiChatExample } from "./chatShared";

const INPUT_MIN_HEIGHT = 44;
const INPUT_MAX_HEIGHT = 124;
const INITIAL_COMPOSER_HEIGHT = 128;
const TOOLBAR_BUTTON_SIZE = 36;
const TOOLBAR_TOP_PADDING = 10;
const TOOLBAR_HEIGHT = TOOLBAR_TOP_PADDING + TOOLBAR_BUTTON_SIZE;
const CLOSED_COMPOSER_PADDING_BOTTOM = 4;
const OPEN_COMPOSER_PADDING_BOTTOM = 12;
const OPEN_COMPOSER_KEYBOARD_GAP = 8;
const IS_IOS = Platform.OS === "ios";

function FloatingChatComposer({
    input,
    keyboardProgress,
    onChangeText,
    onPress,
    sendDisabled,
}: {
    input: string;
    keyboardProgress: SharedValue<number>;
    onChangeText: (text: string) => void;
    onPress: () => void;
    sendDisabled: boolean;
}) {
    const [inputHeight, setInputHeight] = useState(INPUT_MIN_HEIGHT);

    const updateInputHeight = useCallback((event: NativeSyntheticEvent<TextInputContentSizeChangeEventData>) => {
        const nextHeight = Math.min(INPUT_MAX_HEIGHT, Math.max(INPUT_MIN_HEIGHT, event.nativeEvent.contentSize.height));
        setInputHeight((previousHeight) => (previousHeight === nextHeight ? previousHeight : Math.ceil(nextHeight)));
    }, []);

    const toolbarAnimatedStyle = useAnimatedStyle(() => ({
        height: TOOLBAR_HEIGHT * keyboardProgress.value,
        opacity: keyboardProgress.value,
        paddingTop: TOOLBAR_TOP_PADDING * keyboardProgress.value,
    }));
    const composerSurfaceAnimatedStyle = useAnimatedStyle(() => ({
        paddingBottom:
            CLOSED_COMPOSER_PADDING_BOTTOM +
            (OPEN_COMPOSER_PADDING_BOTTOM - CLOSED_COMPOSER_PADDING_BOTTOM) * keyboardProgress.value,
    }));

    return (
        <Animated.View
            style={[
                styles.composerSurface,
                IS_IOS ? styles.composerSurfaceGlass : styles.composerSurfaceSolid,
                composerSurfaceAnimatedStyle,
            ]}
        >
            {IS_IOS ? (
                <LiquidGlassView
                    colorScheme="light"
                    effect="regular"
                    pointerEvents="none"
                    style={[styles.composerLiquidGlass, !isLiquidGlassSupported && styles.composerLiquidGlassFallback]}
                    tintColor="rgba(255, 255, 255, 0.18)"
                />
            ) : null}
            <View style={styles.inputShell}>
                <TextInput
                    multiline
                    onChangeText={onChangeText}
                    onContentSizeChange={updateInputHeight}
                    placeholder="Ask about list behavior"
                    placeholderTextColor="#94A3B8"
                    scrollEnabled={inputHeight >= INPUT_MAX_HEIGHT}
                    style={[styles.input, { height: inputHeight }]}
                    textAlignVertical="top"
                    value={input}
                />
                <Pressable
                    accessibilityLabel="Send message"
                    disabled={sendDisabled}
                    onPress={onPress}
                    style={[styles.sendButton, sendDisabled && styles.sendButtonDisabled]}
                >
                    <MaterialIcons color={sendDisabled ? "#94A3B8" : "#334155"} name="arrow-upward" size={20} />
                </Pressable>
            </View>
            <Animated.View style={[styles.toolbar, toolbarAnimatedStyle]}>
                <Pressable accessibilityLabel="Bold" style={styles.toolbarButton}>
                    <MaterialIcons color="#334155" name="format-bold" size={20} />
                </Pressable>
                <Pressable accessibilityLabel="Italic" style={styles.toolbarButton}>
                    <MaterialIcons color="#334155" name="format-italic" size={20} />
                </Pressable>
                <Pressable accessibilityLabel="List" style={styles.toolbarButton}>
                    <MaterialIcons color="#334155" name="format-list-bulleted" size={20} />
                </Pressable>
                <Pressable accessibilityLabel="Attach link" style={styles.toolbarButton}>
                    <MaterialIcons color="#334155" name="link" size={20} />
                </Pressable>
            </Animated.View>
        </Animated.View>
    );
}

function AiChatFloatingComposerContent() {
    const listRef = useRef<LegendListRef>(null);
    const composerRef = useRef<View>(null);
    const insets = useSafeAreaInsets();
    const { progress } = useReanimatedKeyboardAnimation();
    const { contentInsetEndAdjustment, onComposerLayout } = useKeyboardChatComposerInset(
        listRef,
        composerRef,
        INITIAL_COMPOSER_HEIGHT,
    );
    const { freeze, scrollMessageToEnd } = useKeyboardScrollToEnd({ listRef });
    const scrollMessageToEndCallback = useCallback(() => {
        scrollMessageToEnd({ animated: true, closeKeyboard: true });
    }, [scrollMessageToEnd]);
    const { anchorIndex, input, messages, sendPrompt, setInput } = useAiChatExample({
        scrollMessageToEnd: scrollMessageToEndCallback,
        streamIntervalMs: 5,
        streamStartDelayMs: 700,
    });
    const listProps = getAiChatListProps({ anchorIndex, messages });
    const composerMeasureStyle = useAnimatedStyle(() => ({
        paddingBottom: OPEN_COMPOSER_KEYBOARD_GAP * progress.value,
    }));

    return (
        <View style={styles.screen}>
            <KeyboardGestureArea interpolator="ios" offset={60} style={styles.listArea}>
                <KeyboardChatLegendList
                    contentInsetEndAdjustment={contentInsetEndAdjustment}
                    freeze={freeze}
                    keyboardDismissMode="interactive"
                    keyboardOffset={insets.bottom}
                    ref={listRef}
                    style={styles.list}
                    {...listProps}
                />
            </KeyboardGestureArea>
            <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }} style={styles.composerDock}>
                <Animated.View
                    onLayout={onComposerLayout}
                    ref={composerRef}
                    style={[styles.composerMeasure, composerMeasureStyle]}
                >
                    <SafeAreaView edges={["bottom"]}>
                        <FloatingChatComposer
                            input={input}
                            keyboardProgress={progress}
                            onChangeText={setInput}
                            onPress={() => sendPrompt(input)}
                            sendDisabled={!input.trim()}
                        />
                    </SafeAreaView>
                </Animated.View>
            </KeyboardStickyView>
        </View>
    );
}

export function AiChatFloatingComposerExample() {
    return (
        <KeyboardProvider>
            <AiChatFloatingComposerContent />
        </KeyboardProvider>
    );
}

const styles = StyleSheet.create({
    composerDock: {
        bottom: 0,
        elevation: 20,
        left: 0,
        position: "absolute",
        right: 0,
        zIndex: 20,
    },
    composerLiquidGlass: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 20,
    },
    composerLiquidGlassFallback: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(255, 255, 255, 0.72)",
    },
    composerMeasure: {
        paddingHorizontal: 8,
        paddingTop: 4,
    },
    composerSurface: {
        borderColor: "#E2E8F0",
        borderRadius: 20,
        borderWidth: 1,
        overflow: "hidden",
        paddingBottom: CLOSED_COMPOSER_PADDING_BOTTOM,
        paddingHorizontal: 8,
    },
    composerSurfaceGlass: {
        borderColor: "rgba(255, 255, 255, 0.62)",
        shadowColor: "#0F172A",
        shadowOffset: { height: 12, width: 0 },
        shadowOpacity: 0.16,
        shadowRadius: 28,
    },
    composerSurfaceSolid: {
        backgroundColor: "#FFFFFF",
        shadowColor: "#0F172A",
        shadowOffset: { height: 8, width: 0 },
        shadowOpacity: 0.08,
        shadowRadius: 18,
    },
    input: {
        color: "#111827",
        flex: 1,
        fontSize: 15,
        lineHeight: 20,
        maxHeight: INPUT_MAX_HEIGHT,
        minHeight: INPUT_MIN_HEIGHT,
        paddingHorizontal: 0,
        paddingVertical: 11,
    },
    inputShell: {
        alignItems: "flex-end",
        flexDirection: "row",
        gap: 10,
        paddingHorizontal: 8,
        paddingVertical: 2,
    },
    list: {
        flex: 1,
    },
    listArea: {
        flex: 1,
    },
    screen: {
        flex: 1,
        minHeight: 0,
    },
    sendButton: {
        alignItems: "center",
        backgroundColor: "#F1F5F9",
        borderRadius: 999,
        height: 38,
        justifyContent: "center",
        marginBottom: 3,
        width: 38,
    },
    sendButtonDisabled: {
        opacity: 0.42,
    },
    toolbar: {
        flexDirection: "row",
        gap: 8,
        overflow: "hidden",
        paddingHorizontal: 4,
    },
    toolbarButton: {
        alignItems: "center",
        backgroundColor: "#F8FAFC",
        borderColor: "#E2E8F0",
        borderRadius: 12,
        borderWidth: 1,
        height: 36,
        justifyContent: "center",
        width: 36,
    },
});
