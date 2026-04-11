import React from "react";

import { LegendList } from "@legendapp/list/react";
import { buildDirectoryPeople, type DirectoryPerson } from "@examples/directory";
import { cardStyle, listViewportStyle, Shell } from "./shared";

const directoryPeople = buildDirectoryPeople();

export function DirectoryExample() {
    const [query, setQuery] = React.useState("");
    const filtered = React.useMemo(() => {
        const q = query.toLowerCase();
        return directoryPeople.filter(
            (person) => person.name.toLowerCase().includes(q) || person.department.toLowerCase().includes(q),
        );
    }, [query]);

    return (
        <Shell title="Directory">
            <div style={{ display: "flex", flex: 1, flexDirection: "column", minHeight: 0 }}>
                <input
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search people or team..."
                    style={{
                        background: "#fff",
                        border: "1px solid #e5e7eb",
                        borderRadius: 16,
                        marginBottom: 12,
                        padding: "12px 14px",
                    }}
                    value={query}
                />
                <LegendList
                    data={filtered}
                    estimatedItemSize={72}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }: { item: DirectoryPerson }) => (
                        <div style={{ ...cardStyle(), alignItems: "center", display: "flex", gap: 12 }}>
                            <div
                                style={{
                                    alignItems: "center",
                                    background: item.accent,
                                    borderRadius: 999,
                                    color: "#fff",
                                    display: "flex",
                                    fontWeight: 800,
                                    height: 42,
                                    justifyContent: "center",
                                    width: 42,
                                }}
                            >
                                {item.initials}
                            </div>
                            <div>
                                <div style={{ fontWeight: 800 }}>{item.name}</div>
                                <div style={{ color: "#64748b" }}>
                                    {item.title} · {item.department} · {item.city}
                                </div>
                            </div>
                        </div>
                    )}
                    style={listViewportStyle}
                />
            </div>
        </Shell>
    );
}
