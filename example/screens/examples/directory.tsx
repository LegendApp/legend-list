import { Stack } from "expo-router";

import { DirectoryExample } from "./DirectoryExample";

export default function DirectoryExampleScreen() {
    return (
        <>
            <Stack.Screen options={{ headerTitle: "Directory", headerTransparent: false }} />
            <DirectoryExample />
        </>
    );
}
