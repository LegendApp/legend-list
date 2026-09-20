import { useRef, useState } from "react";
import { Button, Text, View } from "react-native";

import { LegendList, type LegendListRef, type LegendListRenderItemProps } from "@legendapp/list/react-native";

const data = Array.from({ length: 30 }, (_, index) => ({ id: String(index) }));
const shortData = data.slice(0, 3);
const keyExtractor = (item: (typeof data)[number]) => item.id;
const instant = { animated: false };
const animatedFollow = { animated: true };
function Row({ item }: LegendListRenderItemProps<(typeof data)[number]>) {
    return (
        <View style={{ backgroundColor: "#ddeeff", borderBottomWidth: 1, height: 96 }}>
            <Text>Message {item.id}</Text>
        </View>
    );
}

// Deliberately use measured rows and an inaccurate estimate, like a chat.
// The green footer should settle flush with the viewport end, without an
// overshoot/rebound. Resizing while reading history must not return to end.
export default function EndAnchorResize() {
    const ref = useRef<LegendListRef>(null);
    const [pinned, setPinned] = useState(false);
    const [footer, setFooter] = useState(16);
    const [short, setShort] = useState(false);
    const [animated, setAnimated] = useState(false);
    const [generation, setGeneration] = useState(0);
    return (
        <View style={{ flex: 1 }}>
            <Text>End anchoring: resize, footer, short content, and scroll ownership</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                <Button onPress={() => setPinned((value) => !value)} title="Toggle pin" />
                <Button
                    onPress={() => setFooter((value) => (value === 16 ? 80 : value === 80 ? 0 : 16))}
                    title={`Footer ${footer}`}
                />
                <Button onPress={() => setShort((value) => !value)} title={short ? "Long content" : "Short content"} />
                <Button onPress={() => setAnimated((value) => !value)} title={animated ? "Animated" : "Instant"} />
                <Button onPress={() => setGeneration((value) => value + 1)} title="Remount" />
                <Button onPress={() => ref.current?.scrollToOffset({ animated: false, offset: 200 })} title="History" />
                <Button onPress={() => ref.current?.scrollToEnd({ animated })} title="End" />
                <Button
                    onPress={() =>
                        ref.current?.scrollToIndex({
                            animated,
                            index: (short ? shortData : data).length - 1,
                            viewPosition: 0.5,
                        })
                    }
                    title="Center last"
                />
            </View>
            <View style={{ flex: 1 }}>
                {pinned && (
                    <View style={{ backgroundColor: "#ffaaaa", height: 56 }}>
                        <Text>Pinned messages</Text>
                    </View>
                )}
                <LegendList
                    alignItemsAtEnd
                    data={short ? shortData : data}
                    dataKey={short ? "short" : "long"}
                    estimatedItemSize={61}
                    initialScrollAtEnd
                    key={generation}
                    keyExtractor={keyExtractor}
                    ListFooterComponent={<View style={{ backgroundColor: "#00ff00", height: footer }} />}
                    maintainScrollAtEnd={animated ? animatedFollow : instant}
                    maintainVisibleContentPosition
                    ref={ref}
                    renderItem={Row}
                    style={{ flex: 1 }}
                />
            </View>
        </View>
    );
}
