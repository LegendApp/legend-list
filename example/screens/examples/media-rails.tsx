import { Stack } from "expo-router";

import { MediaRailsExample } from "./MediaRailsExample";

export default function MediaRailsScreen() {
    return (
        <>
            <Stack.Screen options={{ headerTitle: "Media Rails", headerTransparent: false }} />
            <MediaRailsExample />
        </>
    );
}
