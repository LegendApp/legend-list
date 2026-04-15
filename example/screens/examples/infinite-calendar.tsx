import { Stack } from "expo-router";

import { InfiniteCalendarExample } from "./InfiniteCalendarExample";

export default function InfiniteCalendarScreen() {
    return (
        <>
            <Stack.Screen options={{ headerTitle: "Infinite Calendar", headerTransparent: false }} />
            <InfiniteCalendarExample />
        </>
    );
}
