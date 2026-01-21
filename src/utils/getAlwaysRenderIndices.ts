import type { AlwaysRenderConfig } from "@/types";

export function getAlwaysRenderIndices<ItemT>(
    config: AlwaysRenderConfig | undefined,
    data: readonly ItemT[],
    keyExtractor: (item: ItemT, index: number) => string,
): number[] {
    if (!config || data.length === 0) {
        return [];
    }

    const result = new Set<number>();
    const dataLength = data.length;

    const addIndex = (index: number) => {
        if (index >= 0 && index < dataLength) {
            result.add(index);
        }
    };

    const toCount = (value: number | undefined) =>
        typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

    const topCount = toCount(config.top);
    if (topCount > 0) {
        for (let i = 0; i < Math.min(topCount, dataLength); i++) {
            addIndex(i);
        }
    }

    const bottomCount = toCount(config.bottom);
    if (bottomCount > 0) {
        for (let i = Math.max(0, dataLength - bottomCount); i < dataLength; i++) {
            addIndex(i);
        }
    }

    if (config.indices?.length) {
        for (const index of config.indices) {
            if (!Number.isFinite(index)) continue;
            addIndex(Math.floor(index));
        }
    }

    if (config.keys?.length) {
        const keys = new Set(config.keys);
        for (let i = 0; i < dataLength && keys.size > 0; i++) {
            const key = keyExtractor(data[i], i);
            if (keys.has(key)) {
                addIndex(i);
                keys.delete(key);
            }
        }
    }

    const indices = Array.from(result);
    indices.sort((a, b) => a - b);
    return indices;
}
