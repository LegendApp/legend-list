import { useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LegendList, type LegendListRef } from "@legendapp/list/react-native";
import { type Item, renderItem } from "~/app/cards-renderItem";
import { RenderWhenLayoutReady } from "~/components/RenderWhenLayoutReady";
import { DRAW_DISTANCE, ESTIMATED_ITEM_LENGTH } from "~/constants/constants";

const DEBUG_INITIAL_SCROLL_ID = "android-initial-scroll-v1";
let debugInitialScrollExampleSeq = 0;

function logInitialScrollExample(event: string, payload: Record<string, unknown>) {
    console.log(`${Date.now()} [debug-log initial-scroll ${DEBUG_INITIAL_SCROLL_ID}] ${event}`, {
        seq: ++debugInitialScrollExampleSeq,
        ...payload,
    });
}

//** Purpose of this component is to show that LegendList with initialScrollIndex can correctly scroll to the beginning
// and the end of the list even if element height is unknown and calculated dynamically */
export default function IntialScrollIndexFreeHeight() {
    const listRef = useRef<LegendListRef>(null);

    const [data, _setData] = useState<Item[]>(
        () =>
            Array.from({ length: 100 }, (_, i) => ({
                id: i.toString(),
            })) as any[],
    );

    const { bottom } = useSafeAreaInsets();

    return (
        <View key="legendlist" style={[StyleSheet.absoluteFill, styles.outerContainer]}>
            <RenderWhenLayoutReady>
                <LegendList
                    contentContainerStyle={styles.listContainer}
                    data={data}
                    drawDistance={DRAW_DISTANCE}
                    estimatedItemSize={ESTIMATED_ITEM_LENGTH}
                    initialScrollIndex={data.length - 1}
                    keyExtractor={(item) => `id${item.id}`}
                    ListFooterComponent={<View style={{ height: 0 }} />}
                    ListHeaderComponent={<View style={{ height: 200 }} />}
                    maintainVisibleContentPosition
                    numColumns={1}
                    onScroll={(event) => {
                        logInitialScrollExample("example-onScroll", {
                            contentHeight: event.nativeEvent.contentSize?.height,
                            offsetY: event.nativeEvent.contentOffset.y,
                            viewportHeight: event.nativeEvent.layoutMeasurement?.height,
                        });
                    }}
                    recycleItems={true}
                    ref={listRef}
                    renderItem={renderItem}
                    style={[StyleSheet.absoluteFill, styles.scrollContainer]}
                />
            </RenderWhenLayoutReady>
        </View>
    );
}

const styles = StyleSheet.create({
    listContainer: {
        marginHorizontal: "auto",
        maxWidth: "100%",
        paddingTop: 200,
        width: "100%",
    },
    listEmpty: {
        alignItems: "center",
        backgroundColor: "#6789AB",
        flex: 1,
        justifyContent: "center",
        paddingVertical: 16,
    },
    listHeader: {
        alignSelf: "center",
        backgroundColor: "#456AAA",
        borderRadius: 12,
        height: 100,
        marginHorizontal: 8,
        marginVertical: 8,
        width: 100,
    },
    outerContainer: {
        backgroundColor: "#456",
    },
    scrollContainer: {},
});
