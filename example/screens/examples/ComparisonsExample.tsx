import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import Cards from "~/components/Cards";
import { DemoStatsBar } from "~/components/DemoStatsBar";
import Movies from "~/components/Movies";
import { type DemoMetricStore, useDemoMetricStore } from "~/lib/demoMetrics";
import {
    COMPARISON_LIBRARIES,
    type ComparisonExampleId,
    type ComparisonLibraryId,
    getComparisonExample,
    getComparisonLibrary,
} from "~/screens/examples/comparisonConfig";
import CardsFlashList from "~/screens/fixtures/cards-flashlist";
import CardsFlatList from "~/screens/fixtures/cards-flatlist";

function ComparisonContent({
    exampleId,
    libraryId,
    metrics,
}: {
    exampleId: ComparisonExampleId;
    libraryId: ComparisonLibraryId;
    metrics: DemoMetricStore;
}) {
    let content = <Cards metrics={metrics} />;

    if (exampleId === "movies") {
        content = <Movies library={libraryId} metrics={metrics} recycleItems />;
    } else if (libraryId === "flatlist") {
        content = <CardsFlatList metrics={metrics} />;
    } else if (libraryId === "flashlist") {
        content = <CardsFlashList metrics={metrics} />;
    }

    return content;
}

export function ComparisonsExample() {
    const router = useRouter();
    const params = useLocalSearchParams<{
        example?: string | string[];
        list?: string | string[];
    }>();
    const example = getComparisonExample(params.example);
    const library = getComparisonLibrary(params.list);

    return (
        <View style={styles.container}>
            <View accessibilityRole="tablist" style={styles.tabs}>
                {COMPARISON_LIBRARIES.map((tab) => {
                    const selected = tab.id === library.id;
                    return (
                        <Pressable
                            accessibilityRole="tab"
                            accessibilityState={{ selected }}
                            key={tab.id}
                            onPress={() => router.setParams({ list: tab.id })}
                            style={[styles.tab, selected ? styles.tabSelected : undefined]}
                        >
                            <Text style={[styles.tabText, selected ? styles.tabTextSelected : undefined]}>
                                {tab.label}
                            </Text>
                        </Pressable>
                    );
                })}
            </View>
            <ComparisonRun exampleId={example.id} key={`${example.id}-${library.id}`} libraryId={library.id} />
        </View>
    );
}

function ComparisonRun({ exampleId, libraryId }: { exampleId: ComparisonExampleId; libraryId: ComparisonLibraryId }) {
    const metrics = useDemoMetricStore([
        { id: "rowRenders", initialValue: 0, label: "Row renders" },
        { id: "mounted", initialValue: 0, label: "Mounted", resettable: false },
        { id: "reassignments", initialValue: 0, label: "Reassigned" },
    ]);

    return (
        <View style={styles.run}>
            <DemoStatsBar store={metrics} />
            <View style={styles.content}>
                <ComparisonContent exampleId={exampleId} libraryId={libraryId} metrics={metrics} />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: "#050505",
        flex: 1,
    },
    content: {
        flex: 1,
    },
    run: {
        flex: 1,
    },
    tab: {
        alignItems: "center",
        borderRadius: 9,
        flex: 1,
        paddingHorizontal: 8,
        paddingVertical: 10,
    },
    tabSelected: {
        backgroundColor: "#4F46E5",
    },
    tabs: {
        backgroundColor: "#FFFFFF",
        borderBottomColor: "#E2E8F0",
        borderBottomWidth: 1,
        flexDirection: "row",
        gap: 4,
        padding: 8,
    },
    tabText: {
        color: "#475569",
        fontSize: 13,
        fontWeight: "700",
    },
    tabTextSelected: {
        color: "#FFFFFF",
    },
});
