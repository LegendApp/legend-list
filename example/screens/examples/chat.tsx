import { Stack } from "expo-router";

import { ChatExample } from "./ChatExample";

export default function ChatExampleScreen() {
    return (
        <>
            <Stack.Screen options={{ headerTitle: "Chat", headerTransparent: false }} />
            <ChatExample />
        </>
    );
}
