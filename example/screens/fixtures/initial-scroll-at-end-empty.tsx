import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LegendList } from "@legendapp/list/react-native";
import { DRAW_DISTANCE, ESTIMATED_ITEM_LENGTH } from "~/constants/constants";
import { type Item, renderItem } from "~/screens/fixtures/shared/cardsRenderItem";

export default function InitialScrollAtEndEmpty() {
    const [data, setData] = useState<Item[]>([]);
    const { bottom } = useSafeAreaInsets();

    useEffect(() => {
        const timeout = setTimeout(() => {
            setData(
                Array.from({ length: 50 }, (_, i) => ({
                    id: i.toString(),
                })),
            );
        }, 500);

        return () => clearTimeout(timeout);
    }, []);

    return (
        <View style={[StyleSheet.absoluteFill, styles.outerContainer]}>
            <LegendList
                data={data}
                drawDistance={DRAW_DISTANCE}
                estimatedItemSize={ESTIMATED_ITEM_LENGTH}
                initialScrollAtEnd
                keyExtractor={(item) => `id${item.id}`}
                ListEmptyComponent={
                    <View style={styles.listEmpty}>
                        <Text style={styles.listEmptyText}>Loading 50 cards...</Text>
                    </View>
                }
                ListFooterComponent={<View style={{ height: bottom }} />}
                renderItem={renderItem}
                style={StyleSheet.absoluteFill}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    listEmpty: {
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 24,
        paddingVertical: 32,
    },
    listEmptyText: {
        color: "#ffffff",
        fontSize: 16,
        fontWeight: "600",
    },
    outerContainer: {
        backgroundColor: "#456",
    },
});
