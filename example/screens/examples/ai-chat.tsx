import { Stack } from "expo-router";

import { AiChatExample } from "./AiChatExample";

export default function AiChatExampleScreen() {
    return (
        <>
            <Stack.Screen options={{ headerTitle: "AI Chat", headerTransparent: false }} />
            <AiChatExample />
        </>
    );
}
