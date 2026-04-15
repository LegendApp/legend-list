import { Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { CardsFeedExample } from "./CardsFeedExample";

export default function CardsFeedScreen() {
    return (
        <>
            <Stack.Screen options={{ headerTitle: "Cards Feed", headerTransparent: false }} />
            <SafeAreaView edges={["bottom"]} style={{ backgroundColor: "#F6F3EE", flex: 1 }}>
                <CardsFeedExample />
            </SafeAreaView>
        </>
    );
}
