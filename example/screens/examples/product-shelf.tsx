import { Stack } from "expo-router";

import { ProductShelfExample } from "../examples";

export default function ProductShelfExampleScreen() {
    return (
        <>
            <Stack.Screen options={{ headerTitle: "Product Shelf", headerTransparent: false }} />
            <ProductShelfExample />
        </>
    );
}
