import { useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { Button, Platform, StyleSheet, Text, View } from "react-native";

import { LegendList, type LegendListRef } from "@legendapp/list/react-native";
import type { Item } from "~/screens/fixtures/shared/renderFixedItem";

const HEADER_HEIGHT = 96;
const ROW_HEIGHT = 80;
const VIEWPORT_HEIGHT = 400;
const MIDDLE_INDEX = 15;
const ITEM_OFFSET = 24;
const DATA: Item[] = Array.from({ length: 30 }, (_, index) => ({ id: String(index) }));
const keyExtractor = (item: Item) => item.id;
const getFixedItemSize = () => ROW_HEIGHT;

export default function TopInsetFixture() {
    const params = useLocalSearchParams<{
        initial?: string;
        short?: string;
        align?: string;
        top?: string;
        bottom?: string;
        header?: string;
        sticky?: string;
        end?: string;
        maintain?: string;
        empty?: string;
        horizontal?: string;
        override?: string;
        adjustment?: "never" | "automatic" | "always";
        offset?: string;
        footer?: string;
        change?: "drag" | "momentum" | "animated";
        viewOffset?: string;
        viewPosition?: string;
    }>();
    // A fresh query mounts a fresh scenario; subsequent controls exercise prop/data updates in place.
    return <TopInsetScenario key={JSON.stringify(params)} params={params} />;
}

function TopInsetScenario({ params }: { params: ReturnType<typeof useLocalSearchParams> }) {
    const list = useRef<LegendListRef>(null);
    const [offset, setOffset] = useState<number>();
    const [top, setTop] = useState(Number(params.top ?? HEADER_HEIGHT));
    const [bottom, setBottom] = useState(Number(params.bottom ?? 0));
    const [data, setData] = useState(params.empty === "1" ? [] : params.short === "1" ? DATA.slice(0, 2) : DATA);
    const horizontal = params.horizontal === "1";
    const insetTop = Platform.OS === "ios" && !horizontal ? top : 0;
    const header = params.header === "1" ? 64 : 0;
    const footer = params.short !== "1" && params.footer !== "0" ? VIEWPORT_HEIGHT - insetTop - ROW_HEIGHT : 0;
    const target = Math.min(MIDDLE_INDEX, data.length - 1);
    const [region, setRegion] = useState(false);
    const [margin, setMargin] = useState(false);
    const [animated, setAnimated] = useState(params.change === "animated");
    const regionOptions = {
        animated,
        ...(region ? { itemLength: 32, itemOffset: ITEM_OFFSET } : {}),
        ...(margin ? { viewportMargin: { end: 18, start: 12 } } : {}),
    };
    const targetOptions = {
        viewOffset: Number(params.viewOffset ?? 0),
        viewPosition: Number(params.viewPosition ?? 0),
    };

    return (
        <View style={styles.screen} testID="top-inset-screen">
            <View style={styles.controls}>
                {[0, target, data.length - 1].map((index, button) => (
                    <Button
                        key={button}
                        onPress={() => {
                            void list.current?.scrollToIndex({ ...targetOptions, animated, index });
                            if (params.change === "animated") setTop(116);
                        }}
                        testID={`top-inset-index-${button}`}
                        title={`Index ${index}`}
                    />
                ))}
                <Button
                    onPress={() => list.current?.scrollToItem({ ...targetOptions, animated, item: data[target] })}
                    testID="top-inset-item"
                    title="Item"
                />
                <Button onPress={() => list.current?.scrollToEnd({ animated })} testID="top-inset-end" title="End" />
                {[0, -insetTop].map((value, button) => (
                    <Button
                        key={button}
                        onPress={() => list.current?.scrollToOffset({ animated, offset: value })}
                        testID={`top-inset-offset-${button}`}
                        title={`Offset ${value}`}
                    />
                ))}
                <Button
                    onPress={() => list.current?.scrollIndexIntoView({ ...regionOptions, index: target })}
                    testID="top-inset-reveal-index"
                    title="Reveal index"
                />
                <Button
                    onPress={() => list.current?.scrollItemIntoView({ ...regionOptions, item: data[target] })}
                    testID="top-inset-reveal-item"
                    title="Reveal item"
                />
                <Button
                    onPress={() => setRegion(!region)}
                    testID="top-inset-region"
                    title={`Region ${region ? "on" : "off"}`}
                />
                <Button
                    onPress={() => setMargin(!margin)}
                    testID="top-inset-margin"
                    title={`Margin ${margin ? "on" : "off"}`}
                />
                <Button
                    onPress={() => setAnimated(!animated)}
                    testID="top-inset-animated"
                    title={`Animate ${animated ? "on" : "off"}`}
                />
                {[62, 116, 0, 96].map((value) => (
                    <Button
                        key={value}
                        onPress={() => setTop(value)}
                        testID={`top-inset-top-${value}`}
                        title={`Top ${value}`}
                    />
                ))}
                <Button
                    onPress={() => {
                        const nextBottom = bottom === 0 ? 120 : 0;
                        setBottom(nextBottom);
                        // Match the keyboard controller's effective-inset notification.
                        list.current?.reportContentInset({ bottom: nextBottom });
                    }}
                    testID="top-inset-keyboard"
                    title={`Bottom ${bottom === 0 ? 120 : 0}`}
                />
                <Button
                    onPress={() => setData((items) => [...items, { id: `append-${items.length}` }])}
                    testID="top-inset-append"
                    title="Append"
                />
                <Button
                    onPress={() => setData((items) => [{ id: `prepend-${items.length}` }, ...items])}
                    testID="top-inset-prepend"
                    title="Prepend"
                />
                <Button onPress={() => setData(DATA)} testID="top-inset-fill" title="Fill" />
                <Button onPress={() => setData([])} testID="top-inset-empty" title="Empty" />
                <Button
                    onPress={() => setData(DATA.map((item) => ({ id: `replace-${item.id}` })))}
                    testID="top-inset-replace"
                    title="Replace"
                />
            </View>
            <Text style={styles.status} testID="top-inset-offset">
                {horizontal ? "x" : "y"}={offset === undefined ? "pending" : offset.toFixed(1)}; T={insetTop}; B=
                {bottom}; H={VIEWPORT_HEIGHT}
                {"\n"}
                rows={data.length}; header={header}; footer={footer}; {horizontal ? "horizontal" : "vertical"}
            </Text>
            <View style={styles.viewport}>
                {Platform.OS === "ios" && !horizontal && (
                    <View pointerEvents="none" style={[styles.header, { height: top }]} testID="top-inset-header">
                        <Text style={styles.headerText}>Top inset · {top} pt</Text>
                        <Text>Index targets align below this line.</Text>
                    </View>
                )}
                <LegendList
                    alignItemsAtEnd={params.short === "1" && params.align !== "0"}
                    automaticallyAdjustContentInsets={params.adjustment === "automatic"}
                    contentInset={{ bottom, top }}
                    contentInsetAdjustmentBehavior={(params.adjustment as "never" | "automatic" | "always") ?? "never"}
                    data={data}
                    getFixedItemSize={getFixedItemSize}
                    horizontal={horizontal}
                    initialScrollAtEnd={params.end === "1"}
                    initialScrollIndex={params.initial === "1" ? { ...targetOptions, index: MIDDLE_INDEX } : undefined}
                    initialScrollOffset={params.offset === undefined ? undefined : Number(params.offset)}
                    keyExtractor={keyExtractor}
                    ListFooterComponent={
                        footer > 0 ? <View style={horizontal ? { width: footer } : { height: footer }} /> : undefined
                    }
                    ListHeaderComponent={
                        header ? (
                            <View style={{ backgroundColor: "#bbf7d0", height: header }}>
                                <Text>List header · 64 pt</Text>
                            </View>
                        ) : undefined
                    }
                    maintainScrollAtEnd={params.maintain === "1"}
                    maintainVisibleContentPosition
                    onLayout={() =>
                        requestAnimationFrame(() => {
                            if (params.override === "1") list.current?.reportContentInset({ top: 96 });
                            setOffset(list.current?.getState().scroll);
                        })
                    }
                    onMomentumScrollBegin={params.change === "momentum" ? () => setTop(116) : undefined}
                    onScroll={(event) =>
                        setOffset(horizontal ? event.nativeEvent.contentOffset.x : event.nativeEvent.contentOffset.y)
                    }
                    onScrollBeginDrag={params.change === "drag" ? () => setTop(116) : undefined}
                    ref={list}
                    renderItem={({ item }) => (
                        <View
                            style={[
                                styles.row,
                                horizontal ? { height: VIEWPORT_HEIGHT, width: ROW_HEIGHT } : { height: ROW_HEIGHT },
                            ]}
                            testID={`top-inset-row-${item.id}`}
                        >
                            <Text style={styles.rowLabel}>Row {item.id}</Text>
                            <View style={styles.region} testID={`top-inset-region-${item.id}`}>
                                <Text>Region +24…56</Text>
                            </View>
                        </View>
                    )}
                    scrollEventThrottle={16}
                    stickyHeaderIndices={params.sticky === "1" ? [0] : undefined}
                    style={styles.list}
                    testID="top-inset-list"
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    controls: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center" },
    header: {
        backgroundColor: "rgba(226, 232, 240, 0.85)",
        borderBottomColor: "#dc2626",
        borderBottomWidth: 2,
        justifyContent: "center",
        left: 0,
        paddingHorizontal: 12,
        position: "absolute",
        right: 0,
        top: 0,
        zIndex: 1,
    },
    headerText: { color: "#0f172a", fontSize: 18, fontWeight: "700" },
    list: { flex: 1 },
    region: { backgroundColor: "#fef08a", height: 32, left: 0, position: "absolute", right: 0, top: ITEM_OFFSET },
    row: { backgroundColor: "#dbeafe", borderTopColor: "#2563eb", borderTopWidth: 1 },
    rowLabel: { color: "#0f172a", fontSize: 18 },
    screen: { backgroundColor: "#ffffff", flex: 1 },
    status: { color: "#0f172a", height: 44, textAlign: "center" },
    viewport: { height: VIEWPORT_HEIGHT },
});
