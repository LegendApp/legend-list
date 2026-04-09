import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import "react-native-reanimated";

import { LogBox } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { configureReanimatedLogger, ReanimatedLogLevel } from "react-native-reanimated";
import { enableFreeze } from "react-native-screens";

import { Colors } from "~/constants/Colors";
import { useColorScheme } from "~/hooks/useColorScheme";

LogBox.ignoreLogs(["FlashList v2 is only supported on new architecture"]);

// Prevent the splash screen from auto-hiding before asset loading is complete.
enableFreeze(); // freeze inactive tabs in the tabbar, to improve benchmarking accuracy

configureReanimatedLogger({
    level: ReanimatedLogLevel.warn,
    strict: false, // Reanimated runs in strict mode by default
});

export default function RootLayout() {
    const colorScheme = useColorScheme();
    console.log("starting in", __DEV__ ? "dev" : "prod");

    const headerTintColor = Colors[colorScheme ?? "light"].text;

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
                <Stack
                    screenOptions={{
                        headerShadowVisible: false,
                        headerTintColor,
                        headerTitle: "",
                        headerTransparent: true,
                    }}
                >
                    <Stack.Screen name="(tabs)" options={{ headerShown: false, title: "Examples" }} />
                    <Stack.Screen name="+not-found" />
                </Stack>
                <StatusBar style="auto" />
            </ThemeProvider>
        </GestureHandlerRootView>
    );
}
