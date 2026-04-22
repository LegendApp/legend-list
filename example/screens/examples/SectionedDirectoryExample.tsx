import { useMemo } from "react";
import { Text, View } from "react-native";

import { LegendList } from "@legendapp/list/react-native";
import {
    buildDirectoryPeople,
    buildSectionedDirectoryRows,
    type SectionedDirectoryRow,
} from "../../../examples-shared/directory";
import { Shell, styles } from "./shared";

export function SectionedDirectoryExample() {
    const people = useMemo(() => buildDirectoryPeople(), []);
    const sectioned = useMemo(() => buildSectionedDirectoryRows(people), [people]);

    return (
        <Shell>
            <LegendList
                contentContainerStyle={styles.list}
                data={sectioned.rows}
                estimatedItemSize={74}
                keyExtractor={(item) => item.id}
                recycleItems
                renderItem={({ item }: { item: SectionedDirectoryRow }) =>
                    item.type === "header" ? (
                        <View style={styles.headerRow}>
                            <Text style={styles.headerText}>{item.title}</Text>
                        </View>
                    ) : (
                        <View style={styles.personRow}>
                            <View style={[styles.avatar, { backgroundColor: item.accent }]}>
                                <Text style={styles.avatarText}>{item.initials}</Text>
                            </View>
                            <View style={styles.personCopy}>
                                <Text style={styles.personName}>{item.name}</Text>
                                <Text style={styles.personMeta}>
                                    {item.title} · {item.city}
                                </Text>
                            </View>
                        </View>
                    )
                }
                stickyHeaderIndices={sectioned.stickyHeaderIndices}
                style={styles.fill}
            />
        </Shell>
    );
}
