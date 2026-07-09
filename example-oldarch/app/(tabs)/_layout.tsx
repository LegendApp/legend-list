import { Tabs } from "expo-router";
import { Platform } from "react-native";

import { HapticTab } from "~/components/HapticTab";
import { IconSymbol } from "~/components/ui/IconSymbol";
import TabBarBackground from "~/components/ui/TabBarBackground";
import { Colors } from "~/constants/Colors";
import { useColorScheme } from "~/hooks/useColorScheme";

export default function TabLayout() {
    const colorScheme = useColorScheme();

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                lazy: true,
                tabBarActiveTintColor: Colors[colorScheme ?? "light"].tint,
                tabBarBackground: TabBarBackground,
                tabBarButton: HapticTab,
                tabBarStyle: Platform.select({
                    ios: {
                        position: "absolute",
                    },
                }),
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    tabBarIcon: ({ color }) => <IconSymbol color={color} name="house.fill" size={28} />,
                    title: "Legend List",
                }}
            />
            <Tabs.Screen
                name="cards"
                options={{
                    tabBarIcon: ({ color }) => (
                        <IconSymbol color={color} name="chevron.left.forwardslash.chevron.right" size={28} />
                    ),
                    title: "Cards",
                }}
            />
            <Tabs.Screen
                name="moviesL"
                options={{
                    tabBarIcon: ({ color }) => <IconSymbol color={color} name="movieclapper" size={28} />,
                    title: "Movies",
                }}
            />
            <Tabs.Screen
                name="moviesLR"
                options={{
                    tabBarIcon: ({ color }) => <IconSymbol color={color} name="film" size={28} />,
                    title: "Movies Recycle",
                }}
            />
        </Tabs>
    );
}
