import { useMemo, useRef, useState } from "react";
import { Button, type NativeScrollEvent, type NativeSyntheticEvent, ScrollView, Text, View } from "react-native";

import { LegendList, type LegendListRef } from "@legendapp/list/react-native";

type Row = { height: number; id: string };
const alwaysRender = { indices: [0] };
const keyExtractor = (item: Row) => item.id;
const nativeMVCP = { minIndexForVisible: 0 };

function RowView({ item }: { item: Row }) {
    return (
        <View
            style={{
                backgroundColor: item.id === "29" ? "#88dd99" : "#ddeeff",
                borderBottomWidth: 1,
                height: item.height,
                padding: 12,
            }}
            testID={`shrink-row-${item.id}`}
        >
            <Text>Row {item.id}</Text>
        </View>
    );
}

// The first row stays mounted so its native measurement can shrink while the
// reader is at the end. Following is disabled to isolate clamping and MVCP.
// The raw ScrollView comparison helps distinguish UIKit/RN behavior from LegendList.
export default function NativeContentShrink() {
    const list = useRef<LegendListRef>(null);
    const raw = useRef<ScrollView>(null);
    const [rawMode, setRawMode] = useState(false);
    const [compact, setCompact] = useState(false);
    const [mvcp, setMVCP] = useState(true);
    const [inset, setInset] = useState(0);
    const [report, setReport] = useState("Press End, then shrink the row above the viewport.");
    const observed = useRef({ content: 0, offset: 0, viewport: 0 });
    const rows = useMemo(
        () =>
            Array.from({ length: 30 }, (_, index) => ({
                height: index === 0 && !compact ? 400 : 100,
                id: String(index),
            })),
        [compact],
    );
    const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
        observed.current = { content: contentSize.height, offset: contentOffset.y, viewport: layoutMeasurement.height };
    };
    const showReport = () => {
        const { content, offset, viewport } = observed.current;
        const remaining = content + inset - offset - viewport;
        setReport(
            `Native offset ${offset.toFixed(1)}, remaining ${remaining.toFixed(1)}; ` +
                (rawMode ? "raw ScrollView" : `LegendList at end: ${list.current?.getState().isAtEnd}`),
        );
    };
    return (
        <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                <Button
                    onPress={() => setRawMode((value) => !value)}
                    title={rawMode ? "Use LegendList" : "Use raw RN"}
                />
                <Button
                    onPress={() => setCompact((value) => !value)}
                    title={compact ? "Expand first row" : "Shrink first row"}
                />
                <Button onPress={() => setMVCP((value) => !value)} title={`MVCP ${mvcp ? "on" : "off"}`} />
                <Button onPress={() => setInset((value) => (value ? 0 : 200))} title={`Inset ${inset}`} />
                <Button
                    onPress={() =>
                        rawMode
                            ? raw.current?.scrollToEnd({ animated: false })
                            : list.current?.scrollToEnd({ animated: false })
                    }
                    title="End"
                />
                <Button onPress={showReport} title="Read geometry" />
            </View>
            <Text style={{ height: 48 }} testID="shrink-geometry">
                {report}
            </Text>
            {rawMode ? (
                <ScrollView
                    contentInset={{ bottom: inset }}
                    maintainVisibleContentPosition={mvcp ? nativeMVCP : undefined}
                    onScroll={onScroll}
                    ref={raw}
                    scrollEventThrottle={16}
                    style={{ flex: 1 }}
                >
                    {rows.map((item) => (
                        <RowView item={item} key={item.id} />
                    ))}
                </ScrollView>
            ) : (
                <LegendList
                    alwaysRender={alwaysRender}
                    contentInset={{ bottom: inset }}
                    data={rows}
                    estimatedItemSize={100}
                    initialScrollAtEnd
                    keyExtractor={keyExtractor}
                    maintainVisibleContentPosition={mvcp}
                    onScroll={onScroll}
                    recycleItems={false}
                    ref={list}
                    renderItem={({ item }) => <RowView item={item} />}
                    scrollEventThrottle={16}
                    style={{ flex: 1 }}
                />
            )}
        </View>
    );
}
