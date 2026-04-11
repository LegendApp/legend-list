import React from "react";

import { LegendList } from "@legendapp/list/react";
import { buildGalleryItems, type GalleryItem } from "@examples/commerce";
import { buttonStyle, cardStyle, listViewportStyle, Shell } from "./shared";

const galleryItems = buildGalleryItems();

export function GalleryGridExample() {
    const [columns, setColumns] = React.useState<2 | 3>(3);

    return (
        <Shell title="Gallery Grid">
            <div style={{ display: "flex", flex: 1, flexDirection: "column", minHeight: 0 }}>
                <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                    <button onClick={() => setColumns(2)} style={buttonStyle(columns === 2)}>
                        2 columns
                    </button>
                    <button onClick={() => setColumns(3)} style={buttonStyle(columns === 3)}>
                        3 columns
                    </button>
                </div>
                <LegendList
                    columnWrapperStyle={{ gap: 12 }}
                    data={galleryItems}
                    estimatedItemSize={160}
                    keyExtractor={(item) => item.id}
                    numColumns={columns}
                    renderItem={({ item }: { item: GalleryItem }) => (
                        <div style={{ ...cardStyle(item.color), color: "#fff", minHeight: 140 }}>
                            <div style={{ fontSize: 18, fontWeight: 800 }}>{item.title}</div>
                            <div style={{ marginTop: 6 }}>{item.tone}</div>
                        </div>
                    )}
                    style={listViewportStyle}
                />
            </div>
        </Shell>
    );
}
