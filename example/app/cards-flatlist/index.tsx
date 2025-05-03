import renderItem from "@/app/cards-renderItem";
import { FlatList, StyleSheet, View } from "react-native";

export default function CardsFlatList() {
    const data = Array.from({ length: 1000 }, (_, i) => ({ id: i.toString() }));

    return (
        <View style={[StyleSheet.absoluteFill, styles.outerContainer]} key="flatlist">
            <FlatList
                style={[StyleSheet.absoluteFill, styles.scrollContainer]}
                data={data}
                renderItem={renderItem as any}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContainer}
                ListHeaderComponent={<View />}
                ListHeaderComponentStyle={styles.listHeader}
                // Performance optimizations
                windowSize={3} // Reduced window size for better performance
                maxToRenderPerBatch={5} // Reduced batch size for smoother scrolling
                initialNumToRender={8} // Initial render amount
                removeClippedSubviews={true} // Detach views outside of the viewport
                updateCellsBatchingPeriod={50} // Batching period for updates
            />
        </View>
    );
}

const styles = StyleSheet.create({
    listHeader: {
        alignSelf: "center",
        height: 100,
        width: 100,
        backgroundColor: "#456AAA",
        borderRadius: 12,
        marginHorizontal: 8,
        marginTop: 8,
    },
    outerContainer: {
        backgroundColor: "#456",
    },
    scrollContainer: {
        // paddingHorizontal: 16,
    },
    titleContainer: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    stepContainer: {
        gap: 8,
        marginBottom: 8,
    },
    reactLogo: {
        height: 178,
        width: 290,
        bottom: 0,
        left: 0,
        position: "absolute",
    },
    itemContainer: {
        // padding: 4,
        // borderBottomWidth: 1,
        // borderBottomColor: "#ccc",
    },
    listContainer: {
        paddingHorizontal: 16,
        // paddingTop: 48,
    },
    itemTitle: {
        fontSize: 18,
        fontWeight: "bold",
        marginBottom: 8,
        color: "#1a1a1a",
    },
    itemBody: {
        fontSize: 14,
        color: "#666666",
        lineHeight: 20,
        flex: 1,
    },
    itemFooter: {
        flexDirection: "row",
        justifyContent: "flex-start",
        gap: 16,
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: "#f0f0f0",
    },
    footerText: {
        fontSize: 14,
        color: "#888888",
    },
});
