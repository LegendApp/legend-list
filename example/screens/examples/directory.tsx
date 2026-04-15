import { Stack } from "expo-router";

import { DirectoryExample } from "../examples";

export default function DirectoryExampleScreen() {
    return (
        <>
            <Stack.Screen options={{ headerTitle: "Directory", headerTransparent: false }} />
            <DirectoryExample />
        </>
    );
}
