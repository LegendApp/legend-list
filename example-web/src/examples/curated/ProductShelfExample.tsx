import React from "react";

import { LegendList } from "@legendapp/list/react";
import { buildProductShelf, type ProductCard, type ProductShelfSection } from "@examples/commerce";
import { listViewportStyle, Shell } from "./shared";

type ShelfRow =
    | { id: string; subtitle: string; title: string; type: "header" }
    | ({ badge: string; type: "product" } & ProductCard);

function buildShelfRows(sections: ProductShelfSection[]) {
    const rows: ShelfRow[] = [];
    const stickyHeaderIndices: number[] = [];

    for (const section of sections) {
        stickyHeaderIndices.push(rows.length);
        rows.push({
            id: `${section.id}-header`,
            subtitle: `${section.items.length} curated picks`,
            title: section.title,
            type: "header",
        });

        for (const [index, item] of section.items.entries()) {
            rows.push({
                ...item,
                badge: index % 2 === 0 ? "Ready to ship" : "Popular",
                type: "product",
            });
        }
    }

    return { rows, stickyHeaderIndices };
}

export function ProductShelfExample() {
    const shelf = React.useMemo(() => buildShelfRows(buildProductShelf()), []);

    return (
        <Shell title="Product Shelf">
            <LegendList
                columnWrapperStyle={{ gap: 12 }}
                data={shelf.rows}
                estimatedItemSize={160}
                getEstimatedItemSize={(item) => (item.type === "header" ? 60 : 160)}
                keyExtractor={(item) => item.id}
                numColumns={2}
                overrideItemLayout={(layout, item) => {
                    if (item.type === "header") {
                        layout.span = 2;
                    }
                }}
                renderItem={({ item }: { item: ShelfRow }) =>
                    item.type === "header" ? (
                        <div
                            style={{
                                background: "#EEF2FF",
                                border: "1px solid #CBD5E1",
                                borderRadius: 0,
                                marginBottom: 10,
                                padding: "10px 12px",
                            }}
                        >
                            <div style={{ fontSize: 18, fontWeight: 800 }}>{item.title}</div>
                            <div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>{item.subtitle}</div>
                        </div>
                    ) : (
                        <div
                            style={{
                                background: item.color,
                                border: "1px solid #e5e7eb",
                                borderRadius: 18,
                                marginBottom: 12,
                                minHeight: 132,
                                padding: 16,
                            }}
                        >
                            <div style={{ fontWeight: 800 }}>{item.title}</div>
                            <div style={{ marginTop: 6 }}>{item.priceLabel}</div>
                            <div style={{ color: "#475569", fontSize: 13, marginTop: 12 }}>{item.badge}</div>
                        </div>
                    )
                }
                stickyHeaderIndices={shelf.stickyHeaderIndices}
                style={listViewportStyle}
            />
        </Shell>
    );
}
