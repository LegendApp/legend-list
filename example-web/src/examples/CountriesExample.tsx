import React from "react";

import { LegendList } from "@/components/LegendList";
import { Text } from "@/platform/Text";
import { View } from "@/platform/View";
import type { Country } from "./utils";
import { useCountries } from "./utils";

export default function CountriesExample() {
    const { countriesData, load } = useCountries();
    const [query, setQuery] = React.useState("");
    const [selectedId, setSelectedId] = React.useState<string | undefined>();

    React.useEffect(() => {
        load();
    }, [load]);

    const filtered = React.useMemo(() => {
        const q = query.toLowerCase();
        return countriesData.filter((c) => c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q));
    }, [countriesData, query]);

    return (
        <View style={{ display: "flex", flex: 1, flexDirection: "column", gap: 8, minHeight: 0 }}>
            <div>
                <input
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search country or code..."
                    style={{
                        background: "#f5f5f5",
                        border: "1px solid #ddd",
                        borderRadius: 8,
                        fontSize: 14,
                        height: 36,
                        padding: "0 10px",
                        width: 300,
                    }}
                    value={query}
                />
            </div>
            <LegendList<Country>
                data={filtered}
                estimatedItemSize={60}
                estimatedListSize={{ height: 520, width: 0 }}
                extraData={selectedId}
                keyExtractor={(item) => item?.id}
                recycleItems
                renderItem={({ item }: { item: Country }) => (
                    <button
                        onClick={() => setSelectedId(item.id)}
                        style={{
                            alignItems: "center",
                            background: selectedId === item.id ? "#eef6ff" : "#fff",
                            border: "1px solid #eee",
                            borderRadius: 8,
                            display: "flex",
                            gap: 12,
                            padding: "8px 12px",
                            textAlign: "left",
                            width: "100%",
                        }}
                        type="button"
                    >
                        <View
                            style={{
                                alignItems: "center",
                                backgroundColor: "#f8f9fa",
                                borderRadius: 20,
                                height: 40,
                                justifyContent: "center",
                                width: 40,
                            }}
                        >
                            <Text style={{ fontSize: 22 }}>{item.flag}</Text>
                        </View>
                        <Text style={{ fontWeight: 500 }}>{item.name} </Text>
                        <Text style={{ color: "#666", fontSize: 12 }}>({item.id})</Text>
                    </button>
                )}
                style={{ borderRadius: 8, flex: 1, minHeight: 0 }}
                waitForInitialLayout={false}
            />
        </View>
    );
}
