import React from "react";

import { LegendList } from "@legendapp/list/react";
import { buildGalleryItems, type GalleryItem } from "@examples/commerce";
import { buttonStyle, CARD_CLASS, cardStyle, listViewportStyle, Shell } from "./shared";

const galleryItems = buildGalleryItems();
const MIN_COLUMNS = 1;
const MAX_COLUMNS = 6;

export function GalleryGridExample() {
    const [columns, setColumns] = React.useState(3);

    return (
        <Shell title="Gallery Grid">
            <div className="flex min-h-0 flex-1 flex-col">
                <div className="mb-3 flex items-center gap-3">
                    <button
                        className={buttonStyle(false)}
                        disabled={columns <= MIN_COLUMNS}
                        onClick={() => setColumns((value) => Math.max(MIN_COLUMNS, value - 1))}
                        type="button"
                    >
                        Decrease
                    </button>
                    <div className="min-w-[96px] text-center text-[14px] font-bold text-slate-900">
                        {columns} columns
                    </div>
                    <button
                        className={buttonStyle(false)}
                        disabled={columns >= MAX_COLUMNS}
                        onClick={() => setColumns((value) => Math.min(MAX_COLUMNS, value + 1))}
                        type="button"
                    >
                        Increase
                    </button>
                </div>
                <LegendList
                    columnWrapperStyle={{ gap: 12 }}
                    data={galleryItems}
                    estimatedItemSize={160}
                    keyExtractor={(item) => item.id}
                    numColumns={columns}
                    recycleItems
                    renderItem={({ item }: { item: GalleryItem }) => (
                        <div className={`${CARD_CLASS} min-h-[140px] text-[#172033]`} style={cardStyle(item.color)}>
                            <div className="text-[18px] font-extrabold">{item.title}</div>
                            <div className="mt-1.5 text-[rgba(23,32,51,0.66)]">{item.tone}</div>
                        </div>
                    )}
                    style={listViewportStyle}
                />
            </div>
        </Shell>
    );
}
