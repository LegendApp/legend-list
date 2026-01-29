import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { LegendList } from "@legendapp/list";

type HeaderItem = {
    id: string;
    title: string;
    type: "header";
};

type ProductItem = {
    id: string;
    title: string;
    price: string;
    color: string;
    type: "product";
};

type ShelfItem = HeaderItem | ProductItem;

const COLORS = [
    "#FFB703",
    "#8ECAE6",
    "#219EBC",
    "#FB8500",
    "#FFAFCC",
    "#BDE0FE",
    "#CDB4DB",
    "#90BE6D",
    "#F94144",
    "#F3722C",
    "#F8961E",
    "#F9C74F",
];

const SECTIONS = [
    { title: "New Arrivals", count: 9 },
    { title: "On Sale", count: 12 },
    { title: "Trending", count: 6 },
    { title: "Top Rated", count: 9 },
];

const formatPrice = (index: number) => `$${(12 + (index % 7) * 3).toFixed(2)}`;

const buildData = (): ShelfItem[] => {
    const items: ShelfItem[] = [];
    let productIndex = 0;

    SECTIONS.forEach((section, sectionIndex) => {
        items.push({
            id: `header-${sectionIndex}`,
            title: section.title,
            type: "header",
        });

        for (let i = 0; i < section.count; i += 1) {
            const currentIndex = productIndex;
            items.push({
                id: `product-${sectionIndex}-${i}`,
                title: `Item ${currentIndex + 1}`,
                price: formatPrice(currentIndex),
                color: COLORS[currentIndex % COLORS.length],
                type: "product",
            });
            productIndex += 1;
        }
    });

    return items;
};

const ProductShelf = () => {
    const data = useMemo(() => buildData(), []);

    return (
        <View style={styles.container}>
            <LegendList
                columnWrapperStyle={styles.columnWrapper}
                contentContainerStyle={styles.content}
                data={data}
                estimatedItemSize={140}
                getEstimatedItemSize={(item) => (item.type === "header" ? 48 : 140)}
                keyExtractor={(item) => item.id}
                numColumns={3}
                overrideItemLayout={(layout, item) => {
                    if (item.type === "header") {
                        layout.span = 3;
                    }
                }}
                renderItem={({ item }) =>
                    item.type === "header" ? <Header item={item} /> : <ProductCard item={item} />
                }
            />
        </View>
    );
};

const Header = ({ item }: { item: HeaderItem }) => (
    <View style={styles.header}>
        <Text style={styles.headerTitle}>{item.title}</Text>
        <Text style={styles.headerSubtitle}>Curated picks for you</Text>
    </View>
);

const ProductCard = ({ item }: { item: ProductItem }) => (
    <View style={[styles.card, { backgroundColor: item.color }]}>
        <View>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardPrice}>{item.price}</Text>
        </View>
        <Text style={styles.cardMeta}>Limited</Text>
    </View>
);

const styles = StyleSheet.create({
    card: {
        borderRadius: 12,
        height: 140,
        justifyContent: "space-between",
        padding: 12,
    },
    cardMeta: {
        color: "#1f1f1f",
        fontSize: 12,
        fontWeight: "600",
        letterSpacing: 0.4,
        textTransform: "uppercase",
    },
    cardPrice: {
        color: "#1f1f1f",
        fontSize: 14,
        fontWeight: "600",
        marginTop: 4,
    },
    cardTitle: {
        color: "#1f1f1f",
        fontSize: 14,
        fontWeight: "600",
    },
    columnWrapper: {
        columnGap: 12,
        rowGap: 12,
    },
    container: {
        backgroundColor: "#F8F5F2",
        flex: 1,
    },
    content: {
        paddingBottom: 24,
        paddingHorizontal: 16,
        paddingTop: 16,
    },
    header: {
        backgroundColor: "#FFFFFF",
        borderRadius: 12,
        marginTop: 4,
        paddingHorizontal: 12,
        paddingVertical: 12,
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
    },
    headerSubtitle: {
        color: "#666666",
        fontSize: 12,
        marginTop: 4,
    },
    headerTitle: {
        color: "#1f1f1f",
        fontSize: 16,
        fontWeight: "700",
    },
});

export default ProductShelf;
