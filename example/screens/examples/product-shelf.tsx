import { Stack } from "expo-router";

import { ProductShelfExample } from "./ProductShelfExample";

export default function ProductShelfExampleScreen() {
    return (
        <>
            <Stack.Screen options={{ headerTitle: "Product Shelf", headerTransparent: false }} />
            <ProductShelfExample />
        </>
    );
}
