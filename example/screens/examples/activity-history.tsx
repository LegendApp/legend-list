import { Stack } from "expo-router";

import { ActivityHistoryExample } from "./ActivityHistoryExample";

export default function ActivityHistoryScreen() {
    return (
        <>
            <Stack.Screen options={{ headerTitle: "Activity History", headerTransparent: false }} />
            <ActivityHistoryExample />
        </>
    );
}
