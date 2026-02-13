import { type PropsWithChildren, useMemo, useState } from 'react';
import { BlurView } from 'expo-blur';
import { Button, type LayoutChangeEvent, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { KeyboardGestureArea, KeyboardProvider, KeyboardStickyView } from 'react-native-keyboard-controller';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { KeyboardAvoidingLegendList } from '@legendapp/list/keyboard';

type Message = {
    id: string;
    text: string;
    sender: 'user' | 'bot';
    timeStamp: number;
};

let idCounter = 0;
const MS_PER_SECOND = 1000;

const defaultChatMessages: Message[] = [
    {
        id: String(idCounter++),
        sender: 'user',
        text: 'Hi, I have a question about your product',
        timeStamp: Date.now() - MS_PER_SECOND * 5,
    },
    {
        id: String(idCounter++),
        sender: 'bot',
        text: 'Hello there! How can I assist you today?',
        timeStamp: Date.now() - MS_PER_SECOND * 4,
    },
    {
        id: String(idCounter++),
        sender: 'user',
        text: "I'm looking for information about pricing plans",
        timeStamp: Date.now() - MS_PER_SECOND * 4,
    },
    {
        id: String(idCounter++),
        sender: 'bot',
        text: 'We offer several pricing tiers based on your needs',
        timeStamp: Date.now() - MS_PER_SECOND * 4,
    },
    {
        id: String(idCounter++),
        sender: 'bot',
        text: 'Our basic plan starts at $9.99 per month',
        timeStamp: Date.now() - MS_PER_SECOND * 4,
    },
    {
        id: String(idCounter++),
        sender: 'user',
        text: 'Do you offer any discounts for annual billing?',
        timeStamp: Date.now() - MS_PER_SECOND * 4,
    },
    {
        id: String(idCounter++),
        sender: 'bot',
        text: 'Yes! You can save 20% with our annual billing option',
        timeStamp: Date.now() - MS_PER_SECOND * 4,
    },
    {
        id: String(idCounter++),
        sender: 'user',
        text: 'That sounds great. What features are included?',
        timeStamp: Date.now() - MS_PER_SECOND * 4,
    },
    {
        id: String(idCounter++),
        sender: 'bot',
        text: 'The basic plan includes all core features plus 10GB storage',
        timeStamp: Date.now() - MS_PER_SECOND * 4,
    },
    {
        id: String(idCounter++),
        sender: 'bot',
        text: 'Premium plans include priority support and additional tools',
        timeStamp: Date.now() - MS_PER_SECOND * 4,
    },
    {
        id: String(idCounter++),
        sender: 'user',
        text: 'I think the basic plan would work for my needs',
        timeStamp: Date.now() - MS_PER_SECOND * 4,
    },
    {
        id: String(idCounter++),
        sender: 'bot',
        text: 'Perfect! I can help you get set up with that',
        timeStamp: Date.now() - MS_PER_SECOND * 4,
    },
    {
        id: String(idCounter++),
        sender: 'user',
        text: 'Thanks for your help so far',
        timeStamp: Date.now() - MS_PER_SECOND * 4,
    },
    {
        id: String(idCounter++),
        sender: 'bot',
        text: "You're welcome! Is there anything else I can assist with today?",
        timeStamp: Date.now() - MS_PER_SECOND * 3,
    },
];

function ChatMessage({ item }: { item: Message }) {
    return (
        <>
            <View
                style={[
                    styles.messageContainer,
                    item.sender === 'bot' ? styles.botMessageContainer : styles.userMessageContainer,
                    item.sender === 'bot' ? styles.botStyle : styles.userStyle,
                ]}
            >
                <Text style={[styles.messageText, item.sender === 'user' && styles.userMessageText]}>{item.text}</Text>
            </View>
            <View style={[styles.timeStamp, item.sender === 'bot' ? styles.botStyle : styles.userStyle]}>
                <Text style={styles.timeStampText}>{new Date(item.timeStamp).toLocaleTimeString()}</Text>
            </View>
        </>
    );
}

const ChatKeyboard = () => {
    const [messages, setMessages] = useState<Message[]>(defaultChatMessages);
    const [inputText, setInputText] = useState('');
    const [inputHeight, setInputHeight] = useState(0); // Default estimate
    const insets = useSafeAreaInsets();

    const handleInputLayout = (event: LayoutChangeEvent) => {
        const { height } = event.nativeEvent.layout;
        setInputHeight(height);
    };

    const contentContainerStyle = useMemo(
        () => [styles.contentContainer, { paddingBottom: inputHeight }],
        [inputHeight],
    );

    const inputContainerStyle = useMemo(
        () => [styles.inputContainer, { paddingBottom: insets.bottom + 10, marginTop: -inputHeight }],
        [inputHeight],
    );

    const sendMessage = () => {
        const text = inputText || 'Empty message';
        if (text.trim()) {
            setMessages((messagesNew) => [
                ...messagesNew,
                { id: String(idCounter++), sender: 'user', text: text, timeStamp: Date.now() },
            ]);
            setInputText('');
            setTimeout(() => {
                setMessages((messagesNew) => [
                    ...messagesNew,
                    {
                        id: String(idCounter++),
                        sender: 'bot',
                        text: `Answer: ${text.toUpperCase()}`,
                        timeStamp: Date.now(),
                    },
                ]);
            }, 300);
        }
    };

    return (
        <KeyboardProvider>
            <View style={[styles.container, { paddingBottom: 0, paddingTop: insets.top }]}>
                <KeyboardGestureArea interpolator="ios" offset={60} style={styles.container}>
                    {inputHeight !== 0 && (
                        <KeyboardAvoidingLegendList
                            alignItemsAtEnd
                            contentContainerStyle={contentContainerStyle}
                            data={messages}
                            estimatedItemSize={80}
                            initialScrollAtEnd
                            keyExtractor={(item) => item.id}
                            maintainScrollAtEnd
                            maintainVisibleContentPosition
                            renderItem={ChatMessage}
                            safeAreaInsetBottom={insets.bottom}
                            style={styles.list}
                        />
                    )}
                </KeyboardGestureArea>
                <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>
                    <BlurView
                        experimentalBlurMethod="dimezisBlurView"
                        style={inputContainerStyle}
                        onLayout={handleInputLayout}
                    >
                        <TextInput
                            onChangeText={setInputText}
                            placeholder="Type a message"
                            style={styles.input}
                            value={inputText}
                            multiline
                        />
                        <Button onPress={sendMessage} title="Send" />
                    </BlurView>
                </KeyboardStickyView>
            </View>
        </KeyboardProvider>
    );
};

const styles = StyleSheet.create({
    botMessageContainer: {
        backgroundColor: '#f1f1f1',
    },
    botStyle: {
        alignSelf: 'flex-start',
        maxWidth: '75%',
    },
    container: {
        backgroundColor: '#fff',
        flex: 1,
    },
    contentContainer: {
        paddingHorizontal: 16,
        // paddingTop: 96,
        // paddingBottom is set dynamically based on input height
    },
    input: {
        backgroundColor: 'white',
        borderColor: '#ccc',
        borderRadius: 5,
        borderWidth: 1,
        flex: 1,
        marginRight: 10,
        padding: 10,
    },
    inputContainer: {
        alignItems: 'center',
        backgroundColor: 'transparent',
        borderColor: '#ccc',
        borderTopWidth: 1,
        flexDirection: 'row',
        padding: 10,
        // marginTop is set dynamically based on input height
    },
    list: {
        flex: 1,
    },
    messageContainer: {
        borderRadius: 16,
        marginVertical: 4,
        padding: 16,
    },
    messageText: {
        fontSize: 16,
    },
    timeStamp: {
        marginVertical: 5,
    },
    timeStampText: {
        color: '#888',
        fontSize: 12,
    },
    userMessageContainer: {
        backgroundColor: '#007AFF',
    },
    userMessageText: {
        color: 'white',
    },
    userStyle: {
        alignItems: 'flex-end',
        alignSelf: 'flex-end',
        maxWidth: '75%',
    },
});

export default ChatKeyboard;
