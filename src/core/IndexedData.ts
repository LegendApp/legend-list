import type { LegendListDataSource } from "@/types.base";
import type { InternalState } from "@/types.internal";

export interface IndexedData<ItemT> {
    readonly kind: "array" | "dataSource";
    getItem(index: number): ItemT | undefined;
    getKey(index: number): string;
    getLegacyData(): readonly ItemT[] | undefined;
    getLength(): number;
}

export class ArrayDataAdapter<ItemT> implements IndexedData<ItemT> {
    readonly kind = "array" as const;

    constructor(
        private readonly data: readonly ItemT[],
        private readonly keyExtractor?: (item: ItemT, index: number) => string,
    ) {}

    getItem(index: number) {
        return index >= 0 && index < this.data.length ? this.data[index] : undefined;
    }

    getKey(index: number) {
        return this.keyExtractor ? this.keyExtractor(this.data[index]!, index) : (index as unknown as string);
    }

    getLegacyData() {
        return this.data;
    }

    getLength() {
        return this.data.length;
    }

    matches(data: readonly ItemT[], keyExtractor?: (item: ItemT, index: number) => string) {
        return this.data === data && this.keyExtractor === keyExtractor;
    }
}

export class DataSourceAdapter<ItemT> implements IndexedData<ItemT> {
    readonly kind = "dataSource" as const;

    constructor(readonly source: LegendListDataSource<ItemT>) {}

    getItem(index: number) {
        return index >= 0 && index < this.source.getLength() ? this.source.getItem(index) : undefined;
    }

    getKey(index: number) {
        return this.source.getKey(index);
    }

    getLegacyData() {
        return undefined;
    }

    getLength() {
        return this.source.getLength();
    }
}

// Share adapter ownership between React renders and imperative layout reads.
// Span caches use this identity, so unchanged inputs must retain it.
export function resolveIndexedData<ItemT>(
    indexedData: IndexedData<ItemT> | undefined,
    data: readonly ItemT[],
    dataSource: LegendListDataSource<ItemT> | undefined,
    keyExtractor?: (item: ItemT, index: number) => string,
): IndexedData<ItemT> {
    if (dataSource) {
        return indexedData instanceof DataSourceAdapter && indexedData.source === dataSource
            ? indexedData
            : new DataSourceAdapter(dataSource);
    }
    return indexedData instanceof ArrayDataAdapter && indexedData.matches(data, keyExtractor)
        ? indexedData
        : new ArrayDataAdapter(data, keyExtractor);
}

const EMPTY_DATA: readonly never[] = [];

export function getIndexedData(state: InternalState): IndexedData<any> {
    const { data, dataSource, keyExtractor } = state.props;
    if (state.indexedData && data === undefined && dataSource === undefined) {
        return state.indexedData;
    }
    state.indexedData = resolveIndexedData(state.indexedData, data ?? EMPTY_DATA, dataSource, keyExtractor);
    return state.indexedData;
}

export function getDataItem(state: InternalState, index: number) {
    return getIndexedData(state).getItem(index);
}

export function getDataKey(state: InternalState, index: number) {
    return getIndexedData(state).getKey(index);
}

export function getDataLength(state: InternalState) {
    return getIndexedData(state).getLength();
}

export function getLegacyData(state: InternalState) {
    return getIndexedData(state).getLegacyData();
}
