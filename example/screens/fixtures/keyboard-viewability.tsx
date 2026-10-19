import { useCallback, useRef, useState } from "react";
import { Button, Keyboard, Text, TextInput, View } from "react-native";
import { KeyboardProvider, KeyboardStickyView, useKeyboardState } from "react-native-keyboard-controller";

import { KeyboardAwareLegendList } from "@legendapp/list/keyboard";
import type { LegendListRef, OnViewableItemsChangedInfo } from "@legendapp/list/react-native";

const rows = Array.from({ length: 40 }, (_, id) => String(id));
const keyExtractor = (item: string) => item;
const fixedSize = () => 100;
const config = { itemVisiblePercentThreshold: 50 };

function Probe() {
    const list = useRef<LegendListRef>(null);
    const input = useRef<TextInput>(null);
    const scroller = useRef<View>(null);
    const observed = useRef({ offset: 0, viewport: 0 });
    const viewable = useRef<number[]>([]);
    const keyboardHeight = useKeyboardState((state) => state.height);
    const [report, setReport] = useState(
        "Open keyboard, move to 600, then read. Compare reported rows with unobscured rows.",
    );
    const onViewable = useCallback((info: OnViewableItemsChangedInfo<string>) => {
        viewable.current = info.viewableItems.map((item) => item.index);
    }, []);
    const read = () => {
        scroller.current?.measureInWindow((_x, top, _width, height) => {
            const { offset, viewport } = observed.current;
            setReport(
                `Native offset ${offset.toFixed(1)}, viewport ${viewport.toFixed(1)}; screen top ${top.toFixed(1)}, height ${height.toFixed(1)}; keyboard ${keyboardHeight}; reported rows ${viewable.current.join(",")}`,
            );
        });
    };
    return (
        <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row" }}>
                <Button onPress={() => input.current?.focus()} title="Open keyboard" />
                <Button onPress={() => Keyboard.dismiss()} title="Close" />
                <Button
                    onPress={() => list.current?.scrollToOffset({ animated: false, offset: 600 })}
                    title="Move to 600"
                />
                <Button onPress={read} title="Read" />
            </View>
            <Text style={{ height: 90 }} testID="viewability-report">
                {report}
            </Text>
            <View collapsable={false} ref={scroller} style={{ flex: 1 }}>
                <KeyboardAwareLegendList
                    data={rows}
                    estimatedItemSize={100}
                    getFixedItemSize={fixedSize}
                    keyboardDismissMode="none"
                    keyExtractor={keyExtractor}
                    onScroll={(event) => {
                        observed.current = {
                            offset: event.nativeEvent.contentOffset.y,
                            viewport: event.nativeEvent.layoutMeasurement.height,
                        };
                    }}
                    onViewableItemsChanged={onViewable}
                    ref={list}
                    renderItem={({ item }) => (
                        <View style={{ backgroundColor: "#ddeeff", borderBottomWidth: 1, height: 100, padding: 12 }}>
                            <Text>Row {item}</Text>
                        </View>
                    )}
                    scrollEventThrottle={16}
                    style={{ flex: 1 }}
                    viewabilityConfig={config}
                />
            </View>
            <KeyboardStickyView style={{ backgroundColor: "#fff", height: 50 }}>
                <TextInput placeholder="Keyboard probe" ref={input} style={{ borderWidth: 1, flex: 1, padding: 8 }} />
            </KeyboardStickyView>
        </View>
    );
}

export default function KeyboardViewability() {
    return (
        <KeyboardProvider>
            <Probe />
        </KeyboardProvider>
    );
}
