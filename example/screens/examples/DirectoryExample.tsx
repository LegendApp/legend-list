import { useMemo, useState } from "react";
import { Text, TextInput, View } from "react-native";

import { LegendList } from "@legendapp/list/react-native";
import { buildDirectoryPeople } from "../../../examples-shared/directory";
import { Shell, styles } from "./shared";

export function DirectoryExample() {
    const people = useMemo(() => buildDirectoryPeople(), []);
    const [query, setQuery] = useState("");
    const filtered = useMemo(() => {
        const lowered = query.toLowerCase();
        return people.filter(
            (person) =>
                person.name.toLowerCase().includes(lowered) ||
                person.department.toLowerCase().includes(lowered) ||
                person.city.toLowerCase().includes(lowered),
        );
    }, [people, query]);

    return (
        <Shell>
            <TextInput
                onChangeText={setQuery}
                placeholder="Search people, team, or city"
                placeholderTextColor="#94A3B8"
                style={styles.search}
                value={query}
            />
            <LegendList
                contentContainerStyle={styles.list}
                data={filtered}
                estimatedItemSize={76}
                keyExtractor={(item) => item.id}
                recycleItems
                renderItem={({ item }) => (
                    <View style={styles.personRow}>
                        <View style={[styles.avatar, { backgroundColor: item.accent }]}>
                            <Text style={styles.avatarText}>{item.initials}</Text>
                        </View>
                        <View style={styles.personCopy}>
                            <Text style={styles.personName}>{item.name}</Text>
                            <Text style={styles.personMeta}>
                                {item.title} · {item.department}
                            </Text>
                            <Text style={styles.personMeta}>{item.city}</Text>
                        </View>
                    </View>
                )}
                style={styles.fill}
            />
        </Shell>
    );
}
