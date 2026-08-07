import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { type AnchoredEndSpaceConfig, LegendList, type LegendListRef } from "@legendapp/list/react-native";

type AnchoredEndSpaceReadyInfo = Parameters<NonNullable<AnchoredEndSpaceConfig["onReady"]>>[0];

type FixtureItem = {
    height: number;
    id: string;
    label: string;
};

const ANCHOR_INDEX = 5;
const ANCHOR_OFFSET = 24;
const ANCHOR_MAX_SIZE = 120;
const SCROLL_AXIS_GAP = 8;
const INITIAL_ITEMS: FixtureItem[] = [
    { height: 72, id: "item-0", label: "Item 0" },
    { height: 96, id: "item-1", label: "Item 1" },
    { height: 84, id: "item-2", label: "Item 2" },
    { height: 110, id: "item-3", label: "Item 3" },
    { height: 150, id: "item-4", label: "Item 4" },
    { height: 88, id: "item-5", label: "Anchor item" },
    { height: 76, id: "item-6", label: "Tail item 6" },
    { height: 104, id: "item-7", label: "Tail item 7" },
];

type AnchoredEndSpaceFixtureState = {
    getState: () => ReturnType<LegendListRef["getState"]> | undefined;
    scrollToEnd: () => void;
    toggleAnchorHeight: () => void;
    toggleAnchorMaxSize: () => void;
    toggleAxis: () => void;
    toggleFooter: () => void;
    togglePadding: () => void;
};

declare global {
    var __legendAnchoredEndSpaceFixture: AnchoredEndSpaceFixtureState | undefined;
}

function Control({ label, onPress }: { label: string; onPress: () => void }) {
    return (
        <Pressable accessibilityRole="button" onPress={onPress} style={styles.control}>
            <Text style={styles.controlText}>{label}</Text>
        </Pressable>
    );
}

export default function AnchoredEndSpaceFixture() {
    const listRef = useRef<LegendListRef>(null);
    const [items, setItems] = useState(INITIAL_ITEMS);
    const [anchorMaxSize, setAnchorMaxSize] = useState<number | undefined>();
    const [footerSize, setFooterSize] = useState(32);
    const [horizontal, setHorizontal] = useState(false);
    const [paddingEnd, setPaddingEnd] = useState(12);
    const [readyInfo, setReadyInfo] = useState<AnchoredEndSpaceReadyInfo>();
    const [spaceSize, setSpaceSize] = useState(0);

    const anchorHeight = items[ANCHOR_INDEX].height;
    const anchorSize = horizontal ? anchorHeight / 2 : anchorHeight;
    const scrollToEnd = useCallback(() => {
        listRef.current?.scrollToEnd({ animated: false });
    }, []);
    const toggleAnchorHeight = useCallback(() => {
        setItems((current) =>
            current.map((item, index) =>
                index === ANCHOR_INDEX ? { ...item, height: item.height === 88 ? 188 : 88 } : item,
            ),
        );
    }, []);
    const toggleAnchorMaxSize = useCallback(() => {
        setAnchorMaxSize((current) => (current === undefined ? ANCHOR_MAX_SIZE : undefined));
    }, []);
    const toggleAxis = useCallback(() => {
        setHorizontal((current) => !current);
    }, []);
    const toggleFooter = useCallback(() => {
        setFooterSize((current) => (current === 32 ? 88 : 32));
    }, []);
    const togglePadding = useCallback(() => {
        setPaddingEnd((current) => (current === 12 ? 52 : 12));
    }, []);
    const onReady = useCallback((info: AnchoredEndSpaceReadyInfo) => {
        setReadyInfo(info);
    }, []);
    const onSizeChanged = useCallback((size: number) => {
        setSpaceSize(size);
    }, []);
    const anchoredEndSpace = useMemo(
        () => ({
            anchorIndex: ANCHOR_INDEX,
            anchorMaxSize,
            anchorOffset: ANCHOR_OFFSET,
            onReady,
            onSizeChanged,
        }),
        [anchorMaxSize, onReady, onSizeChanged],
    );

    useEffect(() => {
        globalThis.__legendAnchoredEndSpaceFixture = {
            getState: () => listRef.current?.getState(),
            scrollToEnd,
            toggleAnchorHeight,
            toggleAnchorMaxSize,
            toggleAxis,
            toggleFooter,
            togglePadding,
        };

        return () => {
            globalThis.__legendAnchoredEndSpaceFixture = undefined;
        };
    }, [scrollToEnd, toggleAnchorHeight, toggleAnchorMaxSize, toggleAxis, toggleFooter, togglePadding]);

    return (
        <View style={styles.screen}>
            <View style={styles.controls}>
                <Control label="Scroll to end" onPress={scrollToEnd} />
                <Control label={`Axis: ${horizontal ? "horizontal" : "vertical"}`} onPress={toggleAxis} />
                <Control label={`Anchor: ${anchorSize}`} onPress={toggleAnchorHeight} />
                <Control label={`Footer: ${footerSize}`} onPress={toggleFooter} />
                <Control label={`Padding: ${paddingEnd}`} onPress={togglePadding} />
                <Control
                    label={`Cap: ${anchorMaxSize === undefined ? "off" : anchorMaxSize}`}
                    onPress={toggleAnchorMaxSize}
                />
            </View>
            <Text style={styles.status} testID="anchored-end-space-status">
                {readyInfo
                    ? `Ready ${readyInfo.anchorKey} · space ${spaceSize} · ${horizontal ? "horizontal" : "vertical"}`
                    : "Waiting for authoritative tail sizes…"}
            </Text>
            <View style={styles.listFrame}>
                <View
                    pointerEvents="none"
                    style={[
                        styles.anchorGuide,
                        horizontal
                            ? [styles.horizontalAnchorGuide, { left: ANCHOR_OFFSET }]
                            : [styles.verticalAnchorGuide, { top: ANCHOR_OFFSET }],
                    ]}
                >
                    <Text style={styles.anchorGuideText}>Expected anchor start</Text>
                </View>
                <LegendList
                    // Changing the axis intentionally remounts this diagnostic list so each
                    // mode starts from a clean end-pinned layout rather than testing a mode transition.
                    anchoredEndSpace={anchoredEndSpace}
                    columnWrapperStyle={horizontal ? styles.itemGap : undefined}
                    contentContainerStyle={[
                        styles.content,
                        horizontal ? { paddingRight: paddingEnd } : { paddingBottom: paddingEnd },
                    ]}
                    data={items}
                    estimatedItemSize={100}
                    horizontal={horizontal}
                    initialScrollAtEnd
                    key={`anchored-end-space-${horizontal ? "horizontal" : "vertical"}`}
                    keyExtractor={(item) => item.id}
                    ListFooterComponent={
                        <View
                            accessibilityLabel="anchored-end-space-footer"
                            style={[styles.footer, horizontal ? { width: footerSize } : { height: footerSize }]}
                        >
                            <Text style={styles.footerText}>Footer {footerSize}</Text>
                        </View>
                    }
                    maintainScrollAtEnd
                    recycleItems
                    ref={listRef}
                    renderItem={({ index, item }) => {
                        const isAnchor = index === ANCHOR_INDEX;
                        const itemSize = horizontal ? item.height / 2 : item.height;
                        return (
                            <View
                                accessibilityLabel={isAnchor ? "anchored-end-space-anchor" : item.label}
                                style={[
                                    styles.item,
                                    horizontal ? { height: 180, width: itemSize } : { height: itemSize },
                                    isAnchor ? styles.anchorItem : styles.regularItem,
                                ]}
                            >
                                <Text style={styles.itemTitle}>{item.label}</Text>
                                <Text style={styles.itemDetail}>
                                    index {index} · size {itemSize}
                                </Text>
                            </View>
                        );
                    }}
                    style={horizontal ? styles.horizontalList : styles.list}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    anchorGuide: {
        position: "absolute",
        zIndex: 2,
    },
    anchorGuideText: {
        alignSelf: "flex-end",
        backgroundColor: "#DCFCE7",
        color: "#166534",
        fontSize: 11,
        fontWeight: "700",
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    anchorItem: {
        backgroundColor: "#FDBA74",
        borderColor: "#C2410C",
    },
    content: {
        paddingHorizontal: 12,
    },
    control: {
        backgroundColor: "#1E293B",
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 8,
    },
    controls: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
        padding: 10,
    },
    controlText: {
        color: "#FFFFFF",
        fontSize: 12,
        fontWeight: "700",
    },
    footer: {
        alignItems: "center",
        backgroundColor: "#C4B5FD",
        justifyContent: "center",
    },
    footerText: {
        color: "#4C1D95",
        fontSize: 12,
        fontWeight: "700",
    },
    horizontalAnchorGuide: {
        borderLeftColor: "#16A34A",
        borderLeftWidth: 2,
        bottom: 0,
        top: 0,
    },
    horizontalList: {
        flexGrow: 0,
        height: 220,
    },
    item: {
        borderRadius: 10,
        borderWidth: 2,
        justifyContent: "center",
        padding: 12,
    },
    itemDetail: {
        color: "#475569",
        fontSize: 12,
        marginTop: 4,
    },
    itemGap: {
        columnGap: SCROLL_AXIS_GAP,
        rowGap: SCROLL_AXIS_GAP,
    },
    itemTitle: {
        color: "#0F172A",
        fontSize: 15,
        fontWeight: "800",
    },
    list: {
        flex: 1,
    },
    listFrame: {
        borderColor: "#94A3B8",
        borderTopWidth: 1,
        flex: 1,
        position: "relative",
    },
    regularItem: {
        backgroundColor: "#DBEAFE",
        borderColor: "#3B82F6",
    },
    screen: {
        backgroundColor: "#F8FAFC",
        flex: 1,
    },
    status: {
        color: "#334155",
        fontSize: 13,
        fontWeight: "600",
        paddingBottom: 8,
        paddingHorizontal: 12,
    },
    verticalAnchorGuide: {
        borderTopColor: "#16A34A",
        borderTopWidth: 2,
        left: 0,
        right: 0,
    },
});
