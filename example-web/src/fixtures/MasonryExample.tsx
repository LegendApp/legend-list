import { MasonryLegendList } from "@legendapp/list/masonry";

const COLORS = ["#7c3aed", "#2563eb", "#0891b2", "#059669", "#ca8a04", "#dc2626"];
const DATA = Array.from({ length: 80 }, (_, index) => ({
    color: COLORS[index % COLORS.length],
    height: 96 + ((index * 47) % 180),
    id: String(index),
}));

export default function MasonryExample() {
    return (
        <MasonryLegendList
            contentContainerStyle={{ columnGap: 12, padding: 12, rowGap: 12 }}
            data={DATA}
            estimatedItemSize={180}
            keyExtractor={(item) => item.id}
            numColumns={3}
            recycleItems
            renderItem={({ item, index }) => (
                <article
                    className="flex flex-col justify-between rounded-[18px] p-4 text-white"
                    style={{ backgroundColor: item.color, height: item.height }}
                >
                    <span className="text-[11px] font-extrabold tracking-[0.12em] text-white/80">
                        CARD {String(index + 1).padStart(2, "0")}
                    </span>
                    <strong className="text-2xl">{item.height}px</strong>
                </article>
            )}
            style={{ height: "100%" }}
        />
    );
}
