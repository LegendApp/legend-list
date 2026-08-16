import { useCallback, useEffect, useRef, useState } from "react";
import {
    type NativeScrollEvent,
    type NativeSyntheticEvent,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { KeyboardGestureArea, KeyboardProvider, KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { KeyboardAwareLegendList } from "@legendapp/list/keyboard";
import { LegendList } from "@legendapp/list/react-native";

type Scenario = "empty-load" | "initial-last" | "mvcp-momentum" | "rapid-append" | "short-keyboard" | "user-cancel";

type Row = {
    id: string;
    label: string;
};

const INITIAL_END_ROWS = createRows("initial", 18);

function createRows(prefix: string, count: number, start = 0): Row[] {
    return Array.from({ length: count }, (_, index) => ({
        id: `${prefix}-${start + index}`,
        label: `${prefix} row ${start + index}`,
    }));
}

function Action({ label, onPress, testID }: { label: string; onPress: () => void; testID: string }) {
    return (
        <Pressable accessibilityRole="button" onPress={onPress} style={styles.action} testID={testID}>
            <Text style={styles.actionText}>{label}</Text>
        </Pressable>
    );
}

function Marker({ children, testID }: { children: string; testID: string }) {
    return (
        <View accessible style={styles.marker} testID={testID}>
            <Text style={styles.markerText}>{children}</Text>
        </View>
    );
}

function RowView({ height = 72, item, testID }: { height?: number; item: Row; testID?: string }) {
    return (
        <View accessible={!!testID} pointerEvents="none" style={[styles.row, { height }]} testID={testID}>
            <Text style={styles.rowText}>{item.label}</Text>
        </View>
    );
}

function ScenarioFrame({ children, title }: { children: React.ReactNode; title: string }) {
    return (
        <View style={styles.scenario} testID={`qa-${title}-screen`}>
            {children}
        </View>
    );
}

function RapidAppendScenario() {
    const [rows, setRows] = useState(INITIAL_END_ROWS);
    const timers = useRef<Array<ReturnType<typeof setTimeout>>>([]);

    useEffect(
        () => () => {
            for (const timer of timers.current) clearTimeout(timer);
        },
        [],
    );

    const appendRapidly = useCallback(() => {
        if (rows.length !== INITIAL_END_ROWS.length) return;

        for (let batch = 0; batch < 4; batch++) {
            const timer = setTimeout(() => {
                setRows((current) => [...current, ...createRows("rapid", 3, batch * 3)]);
            }, batch * 60);
            timers.current.push(timer);
        }
    }, [rows.length]);

    return (
        <ScenarioFrame title="rapid-append">
            <Action label="Append four rapid batches" onPress={appendRapidly} testID="qa-rapid-append-action" />
            <LegendList
                data={rows}
                estimatedItemSize={72}
                initialScrollAtEnd
                keyExtractor={(item) => item.id}
                maintainScrollAtEnd={{ animated: true }}
                recycleItems
                renderItem={({ item }) => (
                    <RowView
                        item={item}
                        testID={
                            item.id === "rapid-11"
                                ? "qa-rapid-append-pass"
                                : item.id === "initial-17"
                                  ? "qa-rapid-baseline-tail"
                                  : undefined
                        }
                    />
                )}
                style={styles.list}
            />
        </ScenarioFrame>
    );
}

function UserCancelScenario() {
    const [appended, setAppended] = useState(false);
    const [awayFromEnd, setAwayFromEnd] = useState(false);
    const [passed, setPassed] = useState(false);
    const [rows, setRows] = useState(() => createRows("cancel", 30));
    const distanceFromEnd = useRef(0);

    const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
        distanceFromEnd.current = Math.max(0, contentSize.height - contentOffset.y - layoutMeasurement.height);
        setAwayFromEnd(distanceFromEnd.current > 120);
    }, []);

    const appendWhileAway = useCallback(() => {
        setPassed(false);
        setAppended(true);
        setRows((current) => [...current, ...createRows("cancel-new", 4)]);
    }, []);

    const verifyCancellation = useCallback(() => {
        setPassed(appended && distanceFromEnd.current > 120);
    }, [appended]);

    return (
        <ScenarioFrame title="user-cancel">
            <View style={styles.actionsRow}>
                <Action label="Append while away" onPress={appendWhileAway} testID="qa-user-cancel-append" />
                <Action label="Verify position" onPress={verifyCancellation} testID="qa-user-cancel-verify" />
            </View>
            {awayFromEnd ? <Marker testID="qa-user-away">Away from end</Marker> : null}
            {appended ? <Marker testID="qa-user-append-observed">Append committed</Marker> : null}
            {passed ? <Marker testID="qa-user-cancel-pass">User position retained</Marker> : null}
            <LegendList
                data={rows}
                estimatedItemSize={72}
                initialScrollAtEnd
                keyExtractor={(item) => item.id}
                maintainScrollAtEnd={{ animated: true }}
                maintainVisibleContentPosition
                onScroll={onScroll}
                recycleItems
                renderItem={({ item }) => (
                    <RowView item={item} testID={item.id === "cancel-29" ? "qa-user-original-tail" : undefined} />
                )}
                scrollEventThrottle={16}
                style={styles.list}
            />
        </ScenarioFrame>
    );
}

function EmptyLoadScenario() {
    const [rows, setRows] = useState<Row[]>([]);

    return (
        <ScenarioFrame title="empty-load">
            {rows.length === 0 ? <Marker testID="qa-empty-load-baseline">List is empty</Marker> : null}
            <Action
                label="Load first page"
                onPress={() => setRows(createRows("loaded", 30))}
                testID="qa-empty-load-action"
            />
            <LegendList
                data={rows}
                estimatedItemSize={72}
                initialScrollAtEnd
                keyExtractor={(item) => item.id}
                maintainScrollAtEnd={{ animated: true }}
                recycleItems
                renderItem={({ item }) => (
                    <RowView item={item} testID={item.id === "loaded-29" ? "qa-empty-load-pass" : undefined} />
                )}
                style={styles.list}
            />
        </ScenarioFrame>
    );
}

function ShortKeyboardScenario() {
    const [passed, setPassed] = useState(false);
    const [rows, setRows] = useState(() => createRows("message", 1));
    const appendStarted = useRef(false);
    const sawRunwayOffset = useRef(false);
    const insets = useSafeAreaInsets();

    const appendBurst = useCallback(() => {
        if (rows.length === 1) {
            appendStarted.current = true;
            sawRunwayOffset.current = false;
            setPassed(false);
            setRows((current) => [...current, ...createRows("reply", 1)]);
        }
    }, [rows.length]);

    const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
        if (!appendStarted.current) return;

        const offset = event.nativeEvent.contentOffset.y;
        if (offset > 1) {
            sawRunwayOffset.current = true;
        } else if (sawRunwayOffset.current) {
            appendStarted.current = false;
            setPassed(true);
        }
    }, []);

    return (
        <KeyboardProvider>
            <ScenarioFrame title="short-keyboard">
                <KeyboardGestureArea interpolator="ios" offset={60} style={styles.list}>
                    <KeyboardAwareLegendList
                        alignItemsAtEnd
                        data={rows}
                        estimatedItemSize={64}
                        initialScrollAtEnd
                        keyboardDismissMode="interactive"
                        keyboardOffset={insets.bottom}
                        keyExtractor={(item) => item.id}
                        maintainScrollAtEnd={{ animated: true }}
                        maintainVisibleContentPosition
                        onScroll={onScroll}
                        recycleItems
                        renderItem={({ item }) => <RowView height={64} item={item} />}
                        scrollEventThrottle={16}
                        style={styles.list}
                    />
                </KeyboardGestureArea>
                <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>
                    <View style={styles.markerSlot}>
                        {passed ? <Marker testID="qa-short-keyboard-pass">Runway completed</Marker> : null}
                    </View>
                    <View style={styles.composer}>
                        <TextInput
                            placeholder="Focus to open keyboard"
                            style={styles.input}
                            testID="qa-short-keyboard-input"
                        />
                        <Action label="Append replies" onPress={appendBurst} testID="qa-short-keyboard-action" />
                    </View>
                </KeyboardStickyView>
            </ScenarioFrame>
        </KeyboardProvider>
    );
}

function MvcpMomentumScenario() {
    const [armed, setArmed] = useState(false);
    const [expandedIndex, setExpandedIndex] = useState<number>();
    const [passed, setPassed] = useState(false);
    const [resizeObserved, setResizeObserved] = useState(false);
    const [rows] = useState(() => createRows("momentum", 60));
    const armedRef = useRef(false);
    const currentOffset = useRef(0);
    const resizeOffset = useRef(0);
    const maxOffsetAfterResize = useRef(0);
    const momentumEnded = useRef(false);
    const resizeMeasured = useRef(false);

    const evaluateResult = useCallback(() => {
        setPassed(
            resizeMeasured.current && momentumEnded.current && maxOffsetAfterResize.current - resizeOffset.current > 60,
        );
    }, []);

    const armResize = useCallback(() => {
        armedRef.current = true;
        momentumEnded.current = false;
        resizeMeasured.current = false;
        setArmed(true);
        setPassed(false);
        setResizeObserved(false);
    }, []);

    const onMomentumScrollBegin = useCallback(() => {
        if (!armedRef.current) return;

        armedRef.current = false;
        resizeOffset.current = currentOffset.current;
        maxOffsetAfterResize.current = currentOffset.current;
        setArmed(false);
        setExpandedIndex(Math.max(0, Math.floor(currentOffset.current / 88)));
    }, []);

    const onMomentumScrollEnd = useCallback(() => {
        momentumEnded.current = true;
        evaluateResult();
    }, [evaluateResult]);

    const onScroll = useCallback(
        (event: NativeSyntheticEvent<NativeScrollEvent>) => {
            currentOffset.current = event.nativeEvent.contentOffset.y;
            if (expandedIndex !== undefined) {
                maxOffsetAfterResize.current = Math.max(maxOffsetAfterResize.current, currentOffset.current);
            }
        },
        [expandedIndex],
    );

    return (
        <ScenarioFrame title="mvcp-momentum">
            <Action label="Arm resize on momentum" onPress={armResize} testID="qa-mvcp-arm" />
            {armed ? <Marker testID="qa-mvcp-armed">Resize armed</Marker> : null}
            {resizeObserved ? <Marker testID="qa-mvcp-resize-applied">Resize applied</Marker> : null}
            {passed ? <Marker testID="qa-mvcp-momentum-pass">Momentum continued after resize</Marker> : null}
            <LegendList
                data={rows}
                drawDistance={600}
                estimatedItemSize={88}
                extraData={expandedIndex}
                initialScrollIndex={15}
                keyExtractor={(item) => item.id}
                maintainVisibleContentPosition
                onMomentumScrollBegin={onMomentumScrollBegin}
                onMomentumScrollEnd={onMomentumScrollEnd}
                onScroll={onScroll}
                recycleItems
                renderItem={({ index, item }) => (
                    <View
                        onLayout={() => {
                            if (index === expandedIndex) {
                                resizeMeasured.current = true;
                                setResizeObserved(true);
                                evaluateResult();
                            }
                        }}
                    >
                        <RowView height={index === expandedIndex ? 208 : 88} item={item} />
                    </View>
                )}
                scrollEventThrottle={16}
                style={styles.list}
                testID="qa-mvcp-list"
            />
        </ScenarioFrame>
    );
}

function InitialLastScenario() {
    const [expanded, setExpanded] = useState(false);
    const [rows] = useState(() => createRows("initial-last", 30));

    return (
        <ScenarioFrame title="initial-last">
            <Action label="Expand viewport" onPress={() => setExpanded(true)} testID="qa-initial-last-resize-action" />
            <LegendList
                contentContainerStyle={styles.initialLastContent}
                data={rows}
                estimatedItemSize={56}
                extraData={expanded}
                initialScrollIndex={rows.length - 1}
                keyExtractor={(item) => item.id}
                maintainVisibleContentPosition
                recycleItems
                renderItem={({ index, item }) => (
                    <RowView
                        height={index % 2 === 0 ? 64 : 92}
                        item={item}
                        testID={
                            index === rows.length - 1
                                ? expanded
                                    ? "qa-initial-last-resize-pass"
                                    : "qa-initial-last-baseline"
                                : undefined
                        }
                    />
                )}
                style={[styles.initialLastList, expanded && styles.initialLastListExpanded]}
            />
        </ScenarioFrame>
    );
}

const SCENARIOS: Array<{ id: Scenario; label: string }> = [
    { id: "rapid-append", label: "Rapid appends" },
    { id: "user-cancel", label: "User cancellation" },
    { id: "empty-load", label: "Empty first load" },
    { id: "short-keyboard", label: "Short keyboard runway" },
    { id: "mvcp-momentum", label: "MVCP momentum resize" },
    { id: "initial-last", label: "Last-index viewport resize" },
];

export default function ScrollRegressionQaFixture() {
    const [scenario, setScenario] = useState<Scenario>();

    return (
        <View style={styles.screen} testID="qa-scroll-regressions-screen">
            {scenario ? (
                <>
                    <Action
                        label="Back to scenarios"
                        onPress={() => setScenario(undefined)}
                        testID="qa-scenario-back"
                    />
                    {scenario === "rapid-append" ? <RapidAppendScenario /> : null}
                    {scenario === "user-cancel" ? <UserCancelScenario /> : null}
                    {scenario === "empty-load" ? <EmptyLoadScenario /> : null}
                    {scenario === "short-keyboard" ? <ShortKeyboardScenario /> : null}
                    {scenario === "mvcp-momentum" ? <MvcpMomentumScenario /> : null}
                    {scenario === "initial-last" ? <InitialLastScenario /> : null}
                </>
            ) : (
                <View style={styles.menu} testID="qa-scenario-menu">
                    <Text style={styles.title}>Scroll regression scenarios</Text>
                    {SCENARIOS.map(({ id, label }) => (
                        <Action key={id} label={label} onPress={() => setScenario(id)} testID={`qa-open-${id}`} />
                    ))}
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    action: {
        alignItems: "center",
        backgroundColor: "#1E293B",
        borderRadius: 8,
        justifyContent: "center",
        minHeight: 42,
        paddingHorizontal: 12,
        paddingVertical: 8,
        zIndex: 2,
    },
    actionsRow: {
        flexDirection: "row",
        gap: 8,
    },
    actionText: {
        color: "#FFFFFF",
        fontSize: 13,
        fontWeight: "700",
    },
    composer: {
        alignItems: "center",
        backgroundColor: "#FFFFFF",
        borderTopColor: "#CBD5E1",
        borderTopWidth: 1,
        flexDirection: "row",
        gap: 8,
        padding: 8,
    },
    initialLastContent: {
        paddingBottom: 24,
    },
    initialLastList: {
        flexGrow: 0,
        height: 280,
    },
    initialLastListExpanded: {
        height: 420,
    },
    input: {
        borderColor: "#94A3B8",
        borderRadius: 8,
        borderWidth: 1,
        flex: 1,
        minHeight: 42,
        paddingHorizontal: 10,
    },
    list: {
        flex: 1,
    },
    marker: {
        alignItems: "center",
        backgroundColor: "#DCFCE7",
        padding: 6,
    },
    markerSlot: {
        height: 28,
    },
    markerText: {
        color: "#166534",
        fontSize: 12,
        fontWeight: "700",
    },
    menu: {
        gap: 10,
        padding: 16,
    },
    row: {
        backgroundColor: "#DBEAFE",
        borderBottomColor: "#93C5FD",
        borderBottomWidth: 1,
        justifyContent: "center",
        paddingHorizontal: 16,
    },
    rowText: {
        color: "#0F172A",
        fontSize: 15,
        fontWeight: "600",
    },
    scenario: {
        flex: 1,
        gap: 8,
        padding: 8,
    },
    screen: {
        backgroundColor: "#F8FAFC",
        flex: 1,
        padding: 8,
    },
    title: {
        color: "#0F172A",
        fontSize: 20,
        fontWeight: "800",
        marginBottom: 8,
    },
});
