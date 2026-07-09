import { useMemo } from "react";
import { Text, View } from "react-native";

import { LegendList } from "@legendapp/list/react-native";
import { buildProductShelf } from "../../../examples-shared/commerce";
import { buildShelfRows, type ShelfRow, Shell, styles } from "./shared";

export function ProductShelfExample() {
    const sections = useMemo(() => buildProductShelf(), []);
    const { rows, stickyHeaderIndices } = useMemo(() => buildShelfRows(sections), [sections]);

    return (
        <Shell>
            <LegendList
                columnWrapperStyle={styles.columnWrapper}
                contentContainerStyle={styles.list}
                data={rows}
                estimatedItemSize={150}
                keyExtractor={(item) => item.id}
                numColumns={2}
                overrideItemLayout={(layout, item) => {
                    if (item.type === "header") {
                        layout.span = 2;
                    }
                }}
                recycleItems
                renderItem={({ item }: { item: ShelfRow }) =>
                    item.type === "header" ? (
                        <View style={styles.shelfHeader}>
                            <Text style={styles.sectionTitle}>{item.title}</Text>
                            <Text style={styles.personMeta}>{item.subtitle}</Text>
                        </View>
                    ) : (
                        <View style={[styles.productCard, { backgroundColor: item.color }]}>
                            <View>
                                <Text style={styles.productTitle}>{item.title}</Text>
                                <Text style={styles.productPrice}>{item.priceLabel}</Text>
                            </View>
                            <Text style={styles.productBadge}>{item.badge}</Text>
                        </View>
                    )
                }
                stickyHeaderConfig={{ offset: 0 }}
                stickyHeaderIndices={stickyHeaderIndices}
                style={styles.fill}
            />
        </Shell>
    );
}
