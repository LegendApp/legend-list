import { Stack } from "expo-router";

import { GalleryGridExample } from "./GalleryGridExample";

export default function GalleryGridScreen() {
    return (
        <>
            <Stack.Screen options={{ headerTitle: "Gallery Grid", headerTransparent: false }} />
            <GalleryGridExample />
        </>
    );
}
