import { Pressable, StyleSheet, Text, View } from "react-native";

export type DemoTab<Id extends string> = {
    id: Id;
    label: string;
};

export function DemoTabs<Id extends string>({
    onSelect,
    selectedId,
    tabs,
}: {
    onSelect: (id: Id) => void;
    selectedId: Id;
    tabs: ReadonlyArray<DemoTab<Id>>;
}) {
    return (
        <View accessibilityRole="tablist" style={styles.tabs}>
            {tabs.map((tab) => {
                const selected = tab.id === selectedId;
                return (
                    <Pressable
                        accessibilityRole="tab"
                        accessibilityState={{ selected }}
                        key={tab.id}
                        onPress={() => onSelect(tab.id)}
                        style={[styles.tab, selected && styles.tabSelected]}
                    >
                        <Text numberOfLines={1} style={[styles.tabText, selected && styles.tabTextSelected]}>
                            {tab.label}
                        </Text>
                    </Pressable>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    tab: {
        alignItems: "center",
        borderRadius: 8,
        flex: 1,
        minWidth: 68,
        paddingHorizontal: 6,
        paddingVertical: 9,
    },
    tabSelected: {
        backgroundColor: "#4F46E5",
    },
    tabs: {
        backgroundColor: "#FFFFFF",
        borderBottomColor: "#E2E8F0",
        borderBottomWidth: 1,
        flexDirection: "row",
        gap: 4,
        padding: 8,
    },
    tabText: {
        color: "#475569",
        fontSize: 12,
        fontWeight: "700",
    },
    tabTextSelected: {
        color: "#FFFFFF",
    },
});
