import { Tabs } from "expo-router";
import { Platform } from "react-native";

import { HapticTab } from "@/components/HapticTab";
import { IconSymbol } from "@/components/ui/IconSymbol";
import TabBarBackground from "@/components/ui/TabBarBackground";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";

export default function TabLayout() {
    const colorScheme = useColorScheme();

    return (
        <Tabs
            screenOptions={{
                tabBarActiveTintColor: Colors[colorScheme ?? "light"].tint,
                headerShown: false,
                lazy: true,
                tabBarButton: HapticTab,
                tabBarBackground: TabBarBackground,
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
                    title: "Legend List",
                    tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
                }}
            />
            <Tabs.Screen
                name="cards"
                options={{
                    title: "Cards",
                    tabBarIcon: ({ color }) => (
                        <IconSymbol size={28} name="chevron.left.forwardslash.chevron.right" color={color} />
                    ),
                }}
            />
             <Tabs.Screen
                name="cards-fc"
                options={{
                    title: "Cards FL",
                    tabBarIcon: ({ color }) => (
                        <IconSymbol size={28} name="chevron.left.forwardslash.chevron.right" color={color} />
                    ),
                }}
            />
             <Tabs.Screen
                name="cards-fc-skel"
                options={{
                    title: "Cards SKEL",
                    tabBarIcon: ({ color }) => (
                        <IconSymbol size={28} name="chevron.left.forwardslash.chevron.right" color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="moviesL"
                options={{
                    title: "Movies",
                    tabBarIcon: ({ color }) => <IconSymbol size={28} name="movieclapper" color={color} />,
                }}
            />
            <Tabs.Screen
                name="moviesLR"
                options={{
                    title: "Movies Recycle",
                    tabBarIcon: ({ color }) => <IconSymbol size={28} name="film" color={color} />,
                }}
            />
        </Tabs>
    );
}
