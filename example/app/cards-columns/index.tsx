import Cards from "@/app/(tabs)/cards";
import { LogBox, Platform, StyleSheet } from "react-native";

LogBox.ignoreLogs(["Open debugger"]);

export default function CardsColumns() {
    return (
        <Cards
            numColumns={2}
            overrideItemLayout={(layout, item, index, numColumns, extraData) => {
                if (index === 3) {
                    layout.span = 2;
                    // layout.size = 150;
                }
            }}
        />
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
        marginVertical: 8,
    },
    listEmpty: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#6789AB",
        paddingVertical: 16,
    },
    outerContainer: {
        backgroundColor: "#456",
        bottom: Platform.OS === "ios" ? 82 : 0,
    },
    scrollContainer: {},
    listContainer: {
        width: 400,
        maxWidth: "100%",
        marginHorizontal: "auto",
    },
});
