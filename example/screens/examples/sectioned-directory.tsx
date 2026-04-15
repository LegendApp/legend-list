import { Stack } from "expo-router";

import { SectionedDirectoryExample } from "../examples";

export default function SectionedDirectoryExampleScreen() {
    return (
        <>
            <Stack.Screen options={{ headerTitle: "Sectioned Directory", headerTransparent: false }} />
            <SectionedDirectoryExample />
        </>
    );
}
