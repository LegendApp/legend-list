import { Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LegendList } from '@legendapp/list';

type HeaderItem = {
    id: string;
    title: string;
    type: 'header';
};

type ProductItem = {
    id: string;
    title: string;
    price: string;
    color: string;
    type: 'product';
};

type ShelfItem = HeaderItem | ProductItem;

const COLORS = [
    '#FFB703',
    '#8ECAE6',
    '#219EBC',
    '#FB8500',
    '#FFAFCC',
    '#BDE0FE',
    '#CDB4DB',
    '#90BE6D',
    '#F94144',
    '#F3722C',
    '#F8961E',
    '#F9C74F',
];

const SECTIONS = [
    { title: 'New Arrivals', count: 9 },
    { title: 'On Sale', count: 12 },
    { title: 'Trending', count: 6 },
    { title: 'Top Rated', count: 9 },
];

const formatPrice = (index: number) => `$${(12 + (index % 7) * 3).toFixed(2)}`;

const buildData = (): { items: ShelfItem[]; headerIndices: number[] } => {
    const items: ShelfItem[] = [];
    const headerIndices: number[] = [];
    let productIndex = 0;

    SECTIONS.forEach((section, sectionIndex) => {
        headerIndices.push(items.length);
        items.push({
            id: `header-${sectionIndex}`,
            title: section.title,
            type: 'header',
        });

        for (let i = 0; i < section.count; i += 1) {
            const currentIndex = productIndex;
            items.push({
                id: `product-${sectionIndex}-${i}`,
                title: `Item ${currentIndex + 1}`,
                price: formatPrice(currentIndex),
                color: COLORS[currentIndex % COLORS.length],
                type: 'product',
            });
            productIndex += 1;
        }
    });

    return { items, headerIndices };
};

const ProductShelf = () => {
    const [stickyHeadersEnabled, setStickyHeadersEnabled] = useState(true);
    const { items, headerIndices } = useMemo(() => buildData(), []);
    const toggleStickyHeaders = () => setStickyHeadersEnabled((prev) => !prev);

    return (
        <>
            <Stack.Screen
                options={{
                    headerTitle: 'Product Shelf',
                    headerTransparent: false,
                }}
            />
            <SafeAreaView edges={['bottom']} style={styles.container}>
                <LegendList
                    columnWrapperStyle={styles.columnWrapper}
                    contentContainerStyle={styles.content}
                    data={items}
                    estimatedItemSize={140}
                    getEstimatedItemSize={(item) => (item.type === 'header' ? 48 : 140)}
                    keyExtractor={(item) => item.id}
                    ListHeaderComponent={
                        <ConfigPanel onToggle={toggleStickyHeaders} stickyHeadersEnabled={stickyHeadersEnabled} />
                    }
                    numColumns={3}
                    overrideItemLayout={(layout, item) => {
                        if (item.type === 'header') {
                            layout.span = 3;
                        }
                    }}
                    renderItem={({ item }) =>
                        item.type === 'header' ? <Header item={item} /> : <ProductCard item={item} />
                    }
                    stickyHeaderIndices={stickyHeadersEnabled ? headerIndices : undefined}
                    stickyHeaderConfig={{ offset: 4 }}
                />
            </SafeAreaView>
        </>
    );
};

const ConfigPanel = ({ stickyHeadersEnabled, onToggle }: { stickyHeadersEnabled: boolean; onToggle: () => void }) => (
    <View style={styles.configPanel}>
        <Text style={styles.configTitle}>Configuration</Text>
        <View style={styles.configRow}>
            <Pressable onPress={onToggle} style={styles.configText}>
                <Text style={styles.configLabel}>Sticky header rows</Text>
                <Text style={styles.configHint}>Keep section headers pinned while scrolling.</Text>
            </Pressable>
            <Switch
                onValueChange={onToggle}
                trackColor={{ false: '#D0D0D0', true: '#2D6A4F' }}
                thumbColor={stickyHeadersEnabled ? '#FFFFFF' : '#F4F3F4'}
                value={stickyHeadersEnabled}
            />
        </View>
    </View>
);

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
        justifyContent: 'space-between',
        padding: 12,
    },
    cardMeta: {
        color: '#1f1f1f',
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 0.4,
        textTransform: 'uppercase',
    },
    cardPrice: {
        color: '#1f1f1f',
        fontSize: 14,
        fontWeight: '600',
        marginTop: 4,
    },
    cardTitle: {
        color: '#1f1f1f',
        fontSize: 14,
        fontWeight: '600',
    },
    columnWrapper: {
        columnGap: 12,
        rowGap: 12,
    },
    configHint: {
        color: '#6B6B6B',
        fontSize: 12,
        marginTop: 2,
    },
    configLabel: {
        color: '#1f1f1f',
        fontSize: 14,
        fontWeight: '600',
    },
    configPanel: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        marginBottom: 12,
        paddingHorizontal: 12,
        paddingVertical: 12,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
    },
    configRow: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 8,
    },
    configText: {
        flex: 1,
        paddingRight: 12,
    },
    configTitle: {
        color: '#1f1f1f',
        fontSize: 16,
        fontWeight: '700',
    },
    container: {
        backgroundColor: '#F8F5F2',
        flex: 1,
    },
    content: {
        paddingBottom: 24,
        paddingHorizontal: 16,
    },
    header: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 12,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
    },
    headerSubtitle: {
        color: '#666666',
        fontSize: 12,
        marginTop: 4,
    },
    headerTitle: {
        color: '#1f1f1f',
        fontSize: 16,
        fontWeight: '700',
    },
});

export default ProductShelf;
