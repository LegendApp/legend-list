import { Stack } from "expo-router";

import { NotificationsInboxExample } from "./NotificationsInboxExample";

export default function NotificationsInboxScreen() {
    return (
        <>
            <Stack.Screen options={{ headerTitle: "Notifications Inbox", headerTransparent: false }} />
            <NotificationsInboxExample />
        </>
    );
}
