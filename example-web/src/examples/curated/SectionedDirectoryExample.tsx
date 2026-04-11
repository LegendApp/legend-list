import React from "react";

import { LegendList } from "@legendapp/list/react";
import { buildDirectoryPeople, buildSectionedDirectoryRows, type SectionedDirectoryRow } from "@examples/directory";
import { cardStyle, listViewportStyle, Shell } from "./shared";

const sectionedDirectory = buildSectionedDirectoryRows(buildDirectoryPeople());

export function SectionedDirectoryExample() {
    return (
        <Shell title="Sectioned Directory">
            <LegendList
                data={sectionedDirectory.rows}
                estimatedItemSize={62}
                keyExtractor={(item) => item.id}
                stickyHeaderIndices={sectionedDirectory.stickyHeaderIndices}
                renderItem={({ item }: { item: SectionedDirectoryRow }) =>
                    item.type === "header" ? (
                        <div
                            style={{
                                ...cardStyle("#E2E8F0"),
                                borderRadius: 0,
                                fontWeight: 800,
                                marginBottom: 8,
                                padding: "10px 12px",
                            }}
                        >
                            {item.title}
                        </div>
                    ) : (
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
                                    {item.title} · {item.city}
                                </div>
                            </div>
                        </div>
                    )
                }
                style={listViewportStyle}
            />
        </Shell>
    );
}
