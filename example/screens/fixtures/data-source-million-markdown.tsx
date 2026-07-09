import { useCallback, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { LegendList, type LegendListRef } from "@legendapp/list/react-native";
import { MutationDataSource } from "~/screens/fixtures/MutationDataSource";

type MarkdownLine = {
    id: string;
    text: string;
};

const LOGICAL_LINE_COUNT = 1_000_000;

function createLine(originalIndex: number): MarkdownLine {
    const kind = originalIndex % 17 === 0 ? "## Section" : originalIndex % 7 === 0 ? "- List item" : "Paragraph";
    return { id: `line-${originalIndex}`, text: `${kind} ${originalIndex + 1}` };
}

export default function DataSourceMillionMarkdownFixture() {
    const listRef = useRef<LegendListRef>(null);
    const insertedId = useRef(0);
    const source = useMemo(
        () =>
            new MutationDataSource<MarkdownLine>({
                generatedItemFactory: createLine,
                generatedKeyPrefix: "line-",
                length: LOGICAL_LINE_COUNT,
            }),
        [],
    );
    const [targetIndex, setTargetIndex] = useState(0);
    const [revision, setRevision] = useState(0);

    const runMutation = useCallback(
        (callback: () => void) => {
            callback();
            setRevision(source.getRevision());
        },
        [source],
    );

    const jumpTo = useCallback(
        (index: number) => {
            const clampedIndex = Math.max(0, Math.min(source.getLength() - 1, index));
            setTargetIndex(clampedIndex);
            listRef.current?.scrollToIndex({ animated: false, index: clampedIndex });
        },
        [source],
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Million-line sparse markdown</Text>
                <Text style={styles.metric}>
                    {source.getLength().toLocaleString()} lines · revision {revision} · target{" "}
                    {targetIndex.toLocaleString()}
                </Text>
                <View style={styles.controls}>
                    <Control label="Start" onPress={() => jumpTo(0)} />
                    <Control label="Middle" onPress={() => jumpTo(Math.floor(source.getLength() / 2))} />
                    <Control label="End" onPress={() => jumpTo(source.getLength() - 1)} />
                    <Control
                        label="Edit"
                        onPress={() =>
                            runMutation(() => {
                                const item = source.getItem(targetIndex)!;
                                source.update(targetIndex, { ...item, text: `${item.text} — edited` }, "preserve");
                            })
                        }
                    />
                    <Control
                        label="Resize"
                        onPress={() =>
                            runMutation(() => {
                                const item = source.getItem(targetIndex)!;
                                source.update(
                                    targetIndex,
                                    {
                                        ...item,
                                        text: `${item.text}\nExpanded content changes this line's measured height.`,
                                    },
                                    "invalidate",
                                );
                            })
                        }
                    />
                    <Control
                        label="Insert"
                        onPress={() =>
                            runMutation(() => {
                                const id = `inserted-${insertedId.current++}`;
                                source.splice(targetIndex, 0, [
                                    { item: { id, text: `Inserted near ${targetIndex}` }, key: id },
                                ]);
                            })
                        }
                    />
                </View>
            </View>
            <LegendList<MarkdownLine>
                dataSource={source}
                estimatedItemSize={44}
                recycleItems
                ref={listRef}
                renderItem={({ index, item }) => (
                    <View style={[styles.line, index === targetIndex && styles.targetLine]}>
                        <Text style={styles.lineNumber}>{index + 1}</Text>
                        <Text style={styles.lineText}>{item?.text ?? "Loading…"}</Text>
                    </View>
                )}
            />
        </View>
    );
}

function Control({ label, onPress }: { label: string; onPress: () => void }) {
    return (
        <Pressable onPress={onPress} style={styles.button}>
            <Text style={styles.buttonText}>{label}</Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    button: { backgroundColor: "#1f2937", borderRadius: 6, paddingHorizontal: 9, paddingVertical: 7 },
    buttonText: { color: "white", fontSize: 12, fontWeight: "700" },
    container: { backgroundColor: "#f8fafc", flex: 1 },
    controls: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 9 },
    header: { backgroundColor: "white", borderBottomColor: "#cbd5e1", borderBottomWidth: 1, padding: 12 },
    line: {
        alignItems: "flex-start",
        borderBottomColor: "#e2e8f0",
        borderBottomWidth: 1,
        flexDirection: "row",
        minHeight: 44,
        padding: 10,
    },
    lineNumber: { color: "#94a3b8", fontVariant: ["tabular-nums"], marginRight: 12, textAlign: "right", width: 72 },
    lineText: { color: "#0f172a", flex: 1, fontFamily: "monospace", fontSize: 14, lineHeight: 20 },
    metric: { color: "#64748b", fontSize: 12, marginTop: 3 },
    targetLine: { backgroundColor: "#dbeafe" },
    title: { color: "#0f172a", fontSize: 17, fontWeight: "800" },
});
