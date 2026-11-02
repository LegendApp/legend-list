import { useRef, useState } from "react";
import { Button, Text, View } from "react-native";

import { LegendList, type LegendListRef } from "@legendapp/list/react-native";

const keyExtractor = (item: string) => item;
const getFixedItemSize = () => 100;
const renderItem = ({ item }: { item: string }) => <Text style={{ height: 100 }}>Row {item}</Text>;

export default function StatusBarFollow() {
    const list = useRef<LegendListRef>(null);
    const observed = useRef(0);
    const [data, setData] = useState(() => Array.from({ length: 40 }, (_, i) => String(i)));
    const [topEvents, setTopEvents] = useState(0);
    const [report, setReport] = useState("Follow at end, tap the status bar, then append.");
    return (
        <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row" }}>
                <Button onPress={() => list.current?.scrollToEnd({ animated: false })} title="End" />
                <Button onPress={() => setData((rows) => [...rows, String(rows.length)])} title="Append" />
                <Button
                    onPress={() =>
                        setReport(
                            `Offset ${observed.current.toFixed(1)}; following ${list.current?.getState().isFollowingEnd}`,
                        )
                    }
                    title="Read"
                />
            </View>
            <Text testID="status-bar-follow-report">{report}</Text>
            <Text testID="status-bar-top-events">Top events: {topEvents}</Text>
            <LegendList
                data={data}
                getFixedItemSize={getFixedItemSize}
                initialScrollAtEnd
                keyExtractor={keyExtractor}
                maintainScrollAtEnd
                maintainVisibleContentPosition={false}
                onScroll={(event) => {
                    observed.current = event.nativeEvent.contentOffset.y;
                }}
                onScrollToTop={() => setTopEvents((count) => count + 1)}
                recycleItems={false}
                ref={list}
                renderItem={renderItem}
                scrollsToTop
                style={{ flex: 1 }}
            />
        </View>
    );
}
