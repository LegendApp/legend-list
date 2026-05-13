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
import { useColorScheme } from "~/hooks/useColorScheme";
import { getThemedAiChatListProps, useAiChatExample } from "./chatShared";

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
const CHAT_COLORS = {
    dark: {
        bodyText: "#E8EAED",
        caret: "#4F8CFF",
        composerBorder: "rgba(255, 255, 255, 0.13)",
        composerFallback: "rgba(26, 29, 33, 0.88)",
        composerSolid: "#1A1D21",
        icon: "#C7CBD1",
        mutedIcon: "#7D838C",
        placeholder: "#9CA3AF",
        promptBubble: "#285A86",
        promptText: "#F8FAFC",
        responseBubble: "#1E2227",
        screen: "#111418",
        sendButton: "rgba(255, 255, 255, 0.08)",
        shadow: "#000000",
        timestamp: "#8D949D",
        tint: "rgba(22, 25, 29, 0.36)",
        toolbarButton: "rgba(255, 255, 255, 0.08)",
        toolbarButtonBorder: "rgba(255, 255, 255, 0.13)",
    },
    light: {
        bodyText: "#111827",
        caret: "#2563EB",
        composerBorder: "#E2E8F0",
        composerFallback: "rgba(255, 255, 255, 0.72)",
        composerSolid: "#FFFFFF",
        icon: "#334155",
        mutedIcon: "#94A3B8",
        placeholder: "#94A3B8",
        promptBubble: "#111827",
        promptText: "#FFFFFF",
        responseBubble: "#FFFFFF",
        screen: "#F6F3EE",
        sendButton: "#F1F5F9",
        shadow: "#0F172A",
        timestamp: "#64748B",
        tint: "rgba(255, 255, 255, 0.18)",
        toolbarButton: "#F8FAFC",
        toolbarButtonBorder: "#E2E8F0",
    },
} as const;

function FloatingChatComposer({
    colors,
    colorScheme,
    input,
    keyboardProgress,
    onChangeText,
    onPress,
    sendDisabled,
}: {
    colors: (typeof CHAT_COLORS)["dark" | "light"];
    colorScheme: "dark" | "light";
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
                { shadowColor: colors.shadow },
                !IS_IOS && {
                    backgroundColor: colors.composerSolid,
                    borderColor: colors.composerBorder,
                    borderWidth: 1,
                },
                composerSurfaceAnimatedStyle,
            ]}
        >
            {IS_IOS ? (
                <LiquidGlassView
                    colorScheme={colorScheme}
                    effect="regular"
                    pointerEvents="none"
                    style={[
                        styles.composerLiquidGlass,
                        !isLiquidGlassSupported && { backgroundColor: colors.composerFallback },
                    ]}
                    tintColor={colors.tint}
                />
            ) : null}
            <View style={styles.inputShell}>
                <TextInput
                    keyboardAppearance={colorScheme}
                    multiline
                    onChangeText={onChangeText}
                    onContentSizeChange={updateInputHeight}
                    placeholder="Ask about list behavior"
                    placeholderTextColor={colors.placeholder}
                    scrollEnabled={inputHeight >= INPUT_MAX_HEIGHT}
                    selectionColor={colors.caret}
                    style={[styles.input, { color: colors.bodyText, height: inputHeight }]}
                    textAlignVertical="top"
                    value={input}
                />
                <Pressable
                    accessibilityLabel="Send message"
                    disabled={sendDisabled}
                    onPress={onPress}
                    style={[
                        styles.sendButton,
                        { backgroundColor: colors.sendButton },
                        sendDisabled && styles.sendButtonDisabled,
                    ]}
                >
                    <MaterialIcons
                        color={sendDisabled ? colors.mutedIcon : colors.icon}
                        name="arrow-upward"
                        size={20}
                    />
                </Pressable>
            </View>
            <Animated.View style={[styles.toolbar, toolbarAnimatedStyle]}>
                <Pressable
                    accessibilityLabel="Bold"
                    style={[
                        styles.toolbarButton,
                        { backgroundColor: colors.toolbarButton, borderColor: colors.toolbarButtonBorder },
                    ]}
                >
                    <MaterialIcons color={colors.icon} name="format-bold" size={20} />
                </Pressable>
                <Pressable
                    accessibilityLabel="Italic"
                    style={[
                        styles.toolbarButton,
                        { backgroundColor: colors.toolbarButton, borderColor: colors.toolbarButtonBorder },
                    ]}
                >
                    <MaterialIcons color={colors.icon} name="format-italic" size={20} />
                </Pressable>
                <Pressable
                    accessibilityLabel="List"
                    style={[
                        styles.toolbarButton,
                        { backgroundColor: colors.toolbarButton, borderColor: colors.toolbarButtonBorder },
                    ]}
                >
                    <MaterialIcons color={colors.icon} name="format-list-bulleted" size={20} />
                </Pressable>
                <Pressable
                    accessibilityLabel="Attach link"
                    style={[
                        styles.toolbarButton,
                        { backgroundColor: colors.toolbarButton, borderColor: colors.toolbarButtonBorder },
                    ]}
                >
                    <MaterialIcons color={colors.icon} name="link" size={20} />
                </Pressable>
            </Animated.View>
        </Animated.View>
    );
}

function AiChatFloatingComposerContent() {
    const colorScheme = useColorScheme() === "dark" ? "dark" : "light";
    const colors = CHAT_COLORS[colorScheme];
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
    const listProps = getThemedAiChatListProps({
        anchorIndex,
        extraData: colorScheme,
        messages,
        theme: {
            bodyTextStyle: { color: colors.bodyText },
            contentContainerStyle: { backgroundColor: colors.screen },
            promptBubbleStyle: { backgroundColor: colors.promptBubble },
            promptTextStyle: { color: colors.promptText },
            responseBubbleStyle: { backgroundColor: colors.responseBubble },
            timestampTextStyle: { color: colors.timestamp },
        },
    });
    const composerMeasureStyle = useAnimatedStyle(() => ({
        paddingBottom: OPEN_COMPOSER_KEYBOARD_GAP * progress.value,
    }));

    return (
        <View style={[styles.screen, { backgroundColor: colors.screen }]}>
            <KeyboardGestureArea interpolator="ios" offset={60} style={styles.listArea}>
                <KeyboardChatLegendList
                    contentInsetEndAdjustment={contentInsetEndAdjustment}
                    freeze={freeze}
                    keyboardDismissMode="interactive"
                    keyboardOffset={insets.bottom}
                    ref={listRef}
                    style={[styles.list, { backgroundColor: colors.screen }]}
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
                            colorScheme={colorScheme}
                            colors={colors}
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
    composerMeasure: {
        paddingHorizontal: 8,
        paddingTop: 4,
    },
    composerSurface: {
        borderRadius: 20,
        overflow: "hidden",
        paddingBottom: CLOSED_COMPOSER_PADDING_BOTTOM,
        paddingHorizontal: 8,
    },
    composerSurfaceGlass: {
        shadowOffset: { height: 12, width: 0 },
        shadowOpacity: 0.16,
        shadowRadius: 28,
    },
    composerSurfaceSolid: {
        shadowOffset: { height: 8, width: 0 },
        shadowOpacity: 0.08,
        shadowRadius: 18,
    },
    input: {
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
        borderRadius: 12,
        borderWidth: 1,
        height: 36,
        justifyContent: "center",
        width: 36,
    },
});
