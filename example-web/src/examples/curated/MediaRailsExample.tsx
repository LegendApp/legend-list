import React from "react";

import { LegendList } from "@legendapp/list/react";
import { buildMediaRails, type MediaPoster, type MediaRail } from "@examples/media";
import { cardStyle, listViewportStyle, Shell } from "./shared";

const mediaRails = buildMediaRails();

export function MediaRailsExample() {
    return (
        <Shell title="Media Rails">
            <LegendList
                data={mediaRails}
                estimatedItemSize={240}
                keyExtractor={(item) => item.id}
                renderItem={({ item }: { item: MediaRail }) => (
                    <div style={{ marginBottom: 18, minWidth: 0 }}>
                        <h2 style={{ margin: "0 0 10px" }}>{item.title}</h2>
                        <LegendList
                            contentContainerStyle={{ paddingBottom: 8, paddingRight: 16 }}
                            data={item.posters}
                            estimatedItemSize={152}
                            horizontal
                            keyExtractor={(poster) => poster.id}
                            renderItem={({ item: poster }: { item: MediaPoster }) => (
                                <div
                                    key={poster.id}
                                    style={{
                                        ...cardStyle(poster.color),
                                        color: "#fff",
                                        height: 170,
                                        marginRight: 12,
                                        minWidth: 132,
                                        width: 132,
                                    }}
                                >
                                    <div style={{ fontWeight: 800 }}>{poster.title}</div>
                                    <div style={{ marginTop: 6, opacity: 0.8 }}>{poster.subtitle}</div>
                                </div>
                            )}
                            style={{ minHeight: 190, minWidth: 0 }}
                        />
                    </div>
                )}
                style={listViewportStyle}
            />
        </Shell>
    );
}
