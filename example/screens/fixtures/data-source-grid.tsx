import { useCallback, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { LegendList } from "@legendapp/list/react-native";
import { MutationDataSource } from "~/screens/fixtures/MutationDataSource";

type Product = { id: string; name: string; span?: number };

export default function DataSourceGridFixture() {
    const nextId = useRef(1_000);
    const source = useMemo(
        () =>
            new MutationDataSource<Product>({
                generatedItemFactory: (index) => ({ id: `product-${index}`, name: `Product ${index + 1}` }),
                generatedKeyPrefix: "product-",
                length: 120,
            }),
        [],
    );
    const [variableSpans, setVariableSpans] = useState(false);
    const [, setRevision] = useState(0);
    const overrideItemLayout = useCallback((layout: { span?: number }, item: Product | undefined) => {
        layout.span = item?.span ?? 1;
    }, []);
    const mutate = (callback: () => void) => {
        callback();
        setRevision(source.getRevision());
    };
    const insert = (span?: number) => {
        mutate(() => {
            const id = `inserted-product-${nextId.current++}`;
            source.splice(3, 0, [
                { item: { id, name: span ? "Inserted promotion row" : "Inserted product", span }, key: id },
            ]);
        });
    };

    return (
        <View style={styles.container}>
            <View style={styles.controls}>
                <Control label="Insert product" onPress={() => insert()} />
                <Control label="Insert span row" onPress={() => insert(4)} />
                <Control label="Move 4" onPress={() => mutate(() => source.move(4, 40, 4))} />
                <Control
                    label={variableSpans ? "Use regular grid" : "Use variable spans"}
                    onPress={() => setVariableSpans((value) => !value)}
                />
            </View>
            <LegendList<Product>
                columnWrapperStyle={styles.columnWrapper}
                dataSource={source}
                estimatedItemSize={116}
                numColumns={4}
                overrideItemLayout={variableSpans ? overrideItemLayout : undefined}
                recycleItems
                renderItem={({ item }) => (
                    <View style={[styles.product, item?.span === 4 && styles.promotion]}>
                        <Text style={styles.productName}>{item?.name ?? "Loading…"}</Text>
                    </View>
                )}
            />
        </View>
    );
}

function Control({ label, onPress }: { label: string; onPress: () => void }) {
    return (
        <Pressable onPress={onPress} style={styles.button}>
            <Text style={styles.buttonText}>{label}</Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    button: { backgroundColor: "#1e293b", borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8 },
    buttonText: { color: "white", fontSize: 11, fontWeight: "700" },
    columnWrapper: { columnGap: 8, rowGap: 8 },
    container: { backgroundColor: "#f8fafc", flex: 1 },
    controls: { backgroundColor: "white", flexDirection: "row", flexWrap: "wrap", gap: 6, padding: 10 },
    product: {
        alignItems: "center",
        backgroundColor: "#dbeafe",
        borderRadius: 8,
        height: 108,
        justifyContent: "center",
        padding: 8,
    },
    productName: { color: "#1e3a8a", fontSize: 13, fontWeight: "700", textAlign: "center" },
    promotion: { backgroundColor: "#fef3c7" },
});
