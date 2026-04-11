import { Stack } from "expo-router";

import { VideoFeedExample } from "../examples";

export default function VideoFeedExampleScreen() {
    return (
        <>
            <Stack.Screen options={{ headerTitle: "Video Feed", headerTransparent: false }} />
            <VideoFeedExample />
        </>
    );
}
