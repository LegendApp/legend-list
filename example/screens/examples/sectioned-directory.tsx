import { Stack } from "expo-router";

import { SectionedDirectoryExample } from "./SectionedDirectoryExample";

export default function SectionedDirectoryExampleScreen() {
    return (
        <>
            <Stack.Screen options={{ headerTitle: "Sectioned Directory", headerTransparent: false }} />
            <SectionedDirectoryExample />
        </>
    );
}
