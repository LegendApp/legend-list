import { FlatList, StyleSheet, View } from "react-native";

import renderItem from "~/app/cards-renderItem";

export default function CardsFlatList() {
    const data = Array.from({ length: 1000 }, (_, i) => ({ id: i.toString() }));

    return (
        <View key="flatlist" style={[StyleSheet.absoluteFill, styles.outerContainer]}>
            <FlatList
                contentContainerStyle={styles.listContainer}
                data={data}
                initialNumToRender={10} // Reduce initial render amount for a closer comparison to LegendList
                keyExtractor={(item) => item.id}
                ListHeaderComponent={<View />}
                ListHeaderComponentStyle={styles.listHeader} // Reduced batch size for smoother scrolling
                renderItem={renderItem as any}
                windowSize={6} // Reduce window size for a closer comparison to LegendList
                // maxToRenderPerBatch={5}
                // initialNumToRender={8}
                // removeClippedSubviews={true} // Reduced window size for better performance
                // style={[StyleSheet.absoluteFill, styles.scrollContainer]} // Initial render amount
                // updateCellsBatchingPeriod={50} // Detach views outside of the viewport
                // windowSize={3} // Batching period for updates
            />
        </View>
    );
}

const styles = StyleSheet.create({
    footerText: {
        color: "#888888",
        fontSize: 14,
    },
    itemBody: {
        color: "#666666",
        flex: 1,
        fontSize: 14,
        lineHeight: 20,
    },
    itemContainer: {
        // padding: 4,
        // borderBottomWidth: 1,
        // borderBottomColor: "#ccc",
    },
    itemFooter: {
        borderTopColor: "#f0f0f0",
        borderTopWidth: 1,
        flexDirection: "row",
        gap: 16,
        justifyContent: "flex-start",
        marginTop: 12,
        paddingTop: 12,
    },
    itemTitle: {
        color: "#1a1a1a",
        fontSize: 18,
        fontWeight: "bold",
        marginBottom: 8,
    },
    listContainer: {
        paddingHorizontal: 16,
        // paddingTop: 48,
    },
    listHeader: {
        alignSelf: "center",
        backgroundColor: "#456AAA",
        borderRadius: 12,
        height: 100,
        marginHorizontal: 8,
        marginTop: 8,
        width: 100,
    },
    outerContainer: {
        backgroundColor: "#456",
    },
    reactLogo: {
        bottom: 0,
        height: 178,
        left: 0,
        position: "absolute",
        width: 290,
    },
    scrollContainer: {
        // paddingHorizontal: 16,
    },
    stepContainer: {
        gap: 8,
        marginBottom: 8,
    },
    titleContainer: {
        alignItems: "center",
        flexDirection: "row",
        gap: 8,
    },
});
