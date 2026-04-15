import React from "react";

import { LegendList } from "@legendapp/list/react";
import { buildGalleryItems, type GalleryItem } from "@examples/commerce";
import { buttonStyle, CARD_CLASS, cardStyle, listViewportStyle, Shell } from "./shared";

const galleryItems = buildGalleryItems();

export function GalleryGridExample() {
    const [columns, setColumns] = React.useState<2 | 3>(3);

    return (
        <Shell title="Gallery Grid">
            <div className="flex min-h-0 flex-1 flex-col">
                <div className="mb-3 flex gap-3">
                    <button className={buttonStyle(columns === 2)} onClick={() => setColumns(2)} type="button">
                        2 columns
                    </button>
                    <button className={buttonStyle(columns === 3)} onClick={() => setColumns(3)} type="button">
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
