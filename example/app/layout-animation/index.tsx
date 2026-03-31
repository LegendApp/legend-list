import { useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearTransition } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { AnimatedLegendList } from "@legendapp/list/reanimated";

type DemoItem = {
    id: string;
    expanded: boolean;
    title: string;
};

const INITIAL_COUNT = 18;

function createItem(index: number): DemoItem {
    return {
        expanded: false,
        id: `item-${index}`,
        title: `Item ${index + 1}`,
    };
}

const INITIAL_DATA = Array.from({ length: INITIAL_COUNT }, (_, i) => createItem(i));

export default function LayoutAnimationExample() {
    const [items, setItems] = useState<DemoItem[]>(INITIAL_DATA);
    const nextIdRef = useRef(INITIAL_DATA.length);
    const mutate = (updater: (prev: DemoItem[]) => DemoItem[]) => setItems((prev) => updater(prev));

    const middleIndex = Math.floor(items.length / 2);

    const controls = useMemo(
        () => [
            {
                key: "insert",
                label: "Insert Middle",
                onPress: () => {
                    mutate((prev) => {
                        const index = Math.floor(prev.length / 2);
                        const id = nextIdRef.current++;
                        const next = [...prev];
                        next.splice(index, 0, {
                            expanded: false,
                            id: `item-${id}`,
                            title: `Inserted ${id + 1}`,
                        });
                        return next;
                    });
                },
            },
            {
                key: "remove",
                label: "Remove Middle",
                onPress: () => {
                    if (items.length <= 1) {
                        return;
                    }
                    mutate((prev) => {
                        const index = Math.floor(prev.length / 2);
                        return prev.filter((_, i) => i !== index);
                    });
                },
            },
            {
                key: "toggle",
                label: "Toggle Height",
                onPress: () => {
                    if (!items.length) {
                        return;
                    }
                    mutate((prev) => {
                        const index = Math.floor(prev.length / 2);
                        return prev.map((item, i) => (i === index ? { ...item, expanded: !item.expanded } : item));
                    });
                },
            },
            {
                key: "insert-many",
                label: "Insert 8",
                onPress: () => {
                    mutate((prev) => {
                        const next = [...prev];
                        const index = Math.floor(next.length / 2);
                        for (let i = 0; i < 8; i++) {
                            const id = nextIdRef.current++;
                            next.splice(index + i, 0, {
                                expanded: i % 2 === 0,
                                id: `item-${id}`,
                                title: `Batch ${id + 1}`,
                            });
                        }
                        return next;
                    });
                },
            },
        ],
        [items.length],
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Reanimated Layout Transition</Text>
                <Text style={styles.subtitle}>Container positions animate via itemLayoutAnimation.</Text>
                <View style={styles.controls}>
                    {controls.map((control) => (
                        <Pressable key={control.key} onPress={control.onPress} style={styles.button}>
                            <Text style={styles.buttonText}>{control.label}</Text>
                        </Pressable>
                    ))}
                </View>
            </View>

            <AnimatedLegendList
                enableDeferredOptimization
                data={items}
                estimatedItemSize={72}
                itemLayoutAnimation={LinearTransition.duration(280)}
                keyExtractor={(item) => item.id}
                maintainVisibleContentPosition={false}
                recycleItems
                renderItem={({ item, index }) => (
                    <View
                        style={[
                            styles.item,
                            item.expanded && styles.itemExpanded,
                            index === middleIndex && styles.middleItem,
                        ]}
                    >
                        <Text style={styles.itemTitle}>{item.title}</Text>
                        <Text style={styles.itemMeta}>ID: {item.id}</Text>
                    </View>
                )}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    button: {
        backgroundColor: "#0f172a",
        borderRadius: 8,
        marginBottom: 8,
        marginRight: 8,
        paddingHorizontal: 10,
        paddingVertical: 8,
    },
    buttonText: {
        color: "#f8fafc",
        fontSize: 12,
        fontWeight: "600",
    },
    container: {
        backgroundColor: "#f8fafc",
        flex: 1,
    },
    controls: {
        flexDirection: "row",
        flexWrap: "wrap",
        marginTop: 12,
    },
    header: {
        borderBottomColor: "#dbe5f0",
        borderBottomWidth: 1,
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    item: {
        backgroundColor: "#ffffff",
        borderBottomColor: "#e2e8f0",
        borderBottomWidth: 1,
        height: 72,
        justifyContent: "center",
        paddingHorizontal: 16,
    },
    itemExpanded: {
        height: 132,
    },
    itemMeta: {
        color: "#64748b",
        fontSize: 12,
        marginTop: 4,
    },
    itemTitle: {
        color: "#0f172a",
        fontSize: 16,
        fontWeight: "600",
    },
    middleItem: {
        backgroundColor: "#ecfeff",
    },
    subtitle: {
        color: "#475569",
        fontSize: 13,
        marginTop: 4,
    },
    title: {
        color: "#0f172a",
        fontSize: 18,
        fontWeight: "700",
    },
});
