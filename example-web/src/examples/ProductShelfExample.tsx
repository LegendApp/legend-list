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
            subtitle: `${section.items.length} featured picks`,
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
    const [columns, setColumns] = React.useState(2);

    return (
        <Shell title="Product Shelf">
            <div className="flex min-h-0 flex-1 flex-col">
                <div className="mb-3 flex items-center gap-3">
                    <button
                        className="cursor-pointer rounded-full border border-gray-300 px-[14px] py-[10px] font-bold disabled:opacity-40"
                        disabled={columns <= 1}
                        onClick={() => setColumns((value) => Math.max(1, value - 1))}
                        type="button"
                    >
                        -
                    </button>
                    <div className="min-w-[96px] text-center text-[14px] font-bold text-slate-900">
                        {columns} columns
                    </div>
                    <button
                        className="cursor-pointer rounded-full border border-gray-300 px-[14px] py-[10px] font-bold disabled:opacity-40"
                        disabled={columns >= 6}
                        onClick={() => setColumns((value) => Math.min(6, value + 1))}
                        type="button"
                    >
                        +
                    </button>
                </div>
                <LegendList
                    columnWrapperStyle={{ gap: 12 }}
                    data={shelf.rows}
                    estimatedItemSize={160}
                    getEstimatedItemSize={(item) => (item.type === "header" ? 60 : 160)}
                    keyExtractor={(item) => item.id}
                    numColumns={columns}
                    overrideItemLayout={(layout, item) => {
                        if (item.type === "header") {
                            layout.span = columns;
                        }
                    }}
                    recycleItems
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
            </div>
        </Shell>
    );
}
