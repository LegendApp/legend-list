import { StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { SectionList } from "@legendapp/list/section-list";

type Item = {
    id: string;
    title: string;
};

type Section = {
    data: Item[];
    key: string;
    title: string;
};

const HEADER_HEIGHT = 44;
const ITEM_HEIGHT = 64;
const FOOTER_HEIGHT = 28;
const ITEM_SEPARATOR_HEIGHT = 8;
const SECTION_SEPARATOR_HEIGHT = 18;

const SECTIONS: Section[] = Array.from({ length: 12 }, (_sectionValue, sectionIndex) => ({
    data: Array.from({ length: 14 }, (_itemValue, itemIndex) => ({
        id: `section-${sectionIndex}-item-${itemIndex}`,
        title: `Item ${itemIndex + 1}`,
    })),
    key: `section-${sectionIndex}`,
    title: `Section ${sectionIndex + 1}`,
}));

export const unstable_settings = {
    initialRouteName: "index",
};

export const createTitle = () => "SectionList Fixed Sizes";

export default function SectionListFixedSizeFixture() {
    return (
        <SafeAreaProvider>
            <View style={styles.container}>
                <View style={styles.legend}>
                    <Text style={styles.title}>SectionList getFixedItemSize</Text>
                    <Text style={styles.subtitle}>
                        Header {HEADER_HEIGHT} / item {ITEM_HEIGHT} / footer {FOOTER_HEIGHT}
                    </Text>
                </View>
                <SectionList<Item, Section>
                    contentContainerStyle={styles.contentContainer}
                    estimatedItemSize={ITEM_HEIGHT}
                    getFixedItemSize={(info) => {
                        switch (info.type) {
                            case "header":
                                return HEADER_HEIGHT;
                            case "item":
                                return ITEM_HEIGHT;
                            case "footer":
                                return FOOTER_HEIGHT;
                            case "item-separator":
                                return ITEM_SEPARATOR_HEIGHT;
                            case "section-separator":
                                return SECTION_SEPARATOR_HEIGHT;
                        }
                    }}
                    ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
                    keyExtractor={(item) => item.id}
                    recycleItems
                    renderItem={({ index, item, section }) => (
                        <View style={styles.item}>
                            <Text style={styles.itemTitle}>{item.title}</Text>
                            <Text style={styles.itemSubtitle}>
                                {section.title} / row {index + 1}
                            </Text>
                        </View>
                    )}
                    renderSectionFooter={({ section }) => (
                        <View style={styles.footer}>
                            <Text style={styles.footerText}>{section.title} footer</Text>
                        </View>
                    )}
                    renderSectionHeader={({ section }) => (
                        <View style={styles.header}>
                            <Text style={styles.headerText}>{section.title}</Text>
                        </View>
                    )}
                    SectionSeparatorComponent={() => <View style={styles.sectionSeparator} />}
                    sections={SECTIONS}
                    stickySectionHeadersEnabled
                    style={styles.list}
                />
            </View>
        </SafeAreaProvider>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: "#eef2f7",
        flex: 1,
    },
    contentContainer: {
        paddingBottom: 24,
    },
    footer: {
        alignItems: "center",
        backgroundColor: "#e0f2fe",
        height: FOOTER_HEIGHT,
        justifyContent: "center",
    },
    footerText: {
        color: "#0369a1",
        fontSize: 12,
        fontWeight: "700",
    },
    header: {
        backgroundColor: "#111827",
        height: HEADER_HEIGHT,
        justifyContent: "center",
        paddingHorizontal: 16,
    },
    headerText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "800",
    },
    item: {
        backgroundColor: "#fff",
        height: ITEM_HEIGHT,
        justifyContent: "center",
        paddingHorizontal: 16,
    },
    itemSeparator: {
        backgroundColor: "#dbeafe",
        height: ITEM_SEPARATOR_HEIGHT,
    },
    itemSubtitle: {
        color: "#64748b",
        fontSize: 12,
        marginTop: 4,
    },
    itemTitle: {
        color: "#111827",
        fontSize: 15,
        fontWeight: "700",
    },
    legend: {
        backgroundColor: "#fff",
        borderBottomColor: "#d1d5db",
        borderBottomWidth: StyleSheet.hairlineWidth,
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    list: {
        flex: 1,
    },
    sectionSeparator: {
        backgroundColor: "#c7d2fe",
        height: SECTION_SEPARATOR_HEIGHT,
    },
    subtitle: {
        color: "#64748b",
        fontSize: 12,
        marginTop: 4,
    },
    title: {
        color: "#111827",
        fontSize: 16,
        fontWeight: "800",
    },
});
