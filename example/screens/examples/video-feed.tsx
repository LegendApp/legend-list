import { Stack } from "expo-router";

import { VideoFeedExample } from "./VideoFeedExample";

export default function VideoFeedExampleScreen() {
    return (
        <>
            <Stack.Screen options={{ headerTitle: "Video Feed", headerTransparent: false }} />
            <VideoFeedExample />
        </>
    );
}
