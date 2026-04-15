import React from "react";

import { LegendList } from "@legendapp/list/react";
import { buildProductShelf, type ProductCard, type ProductShelfSection } from "@examples/commerce";
import { CARD_CLASS, listViewportStyle, Shell } from "./shared";

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
                            className="mb-[10px] border border-slate-300 bg-indigo-50 px-3 py-[10px]"
                            style={{
                                borderRadius: 0,
                            }}
                        >
                            <div className="text-[18px] font-extrabold">{item.title}</div>
                            <div className="mt-1 text-[13px] text-slate-500">{item.subtitle}</div>
                        </div>
                    ) : (
                        <div
                            className={`${CARD_CLASS} min-h-[132px]`}
                            style={{
                                background: item.color,
                            }}
                        >
                            <div className="font-extrabold">{item.title}</div>
                            <div className="mt-1.5">{item.priceLabel}</div>
                            <div className="mt-3 text-[13px] text-slate-600">{item.badge}</div>
                        </div>
                    )
                }
                stickyHeaderIndices={shelf.stickyHeaderIndices}
                style={listViewportStyle}
            />
        </Shell>
    );
}
