import { LayoutStoreRuntime } from "@/core/LayoutStoreRuntime";
import type { InternalState } from "@/types.internal";
import { getId } from "@/utils/getId";

type LayoutField = "columnSpans" | "columns" | "positions";

class TestLayoutStore {
    private columns: Array<number | undefined> = [];
    private estimatedSize: number;
    private offsets: Array<number | undefined> = [];
    private sizes: Array<number | undefined> = [];
    private spans: Array<number | undefined> = [];
    length: number;
    private state: InternalState;

    constructor(state: InternalState, length: number, estimatedSize: number) {
        this.length = length;
        this.estimatedSize = estimatedSize;
        this.state = state;
    }

    clearKnownSizes() {
        this.sizes.length = 0;
    }

    findIndexRangeAtOffsets(startOffset: number, endOffset: number) {
        let range: { end: number; start: number } | undefined;
        if (this.length > 0) {
            const start = this.findIndexAtOffset(startOffset) ?? this.length - 1;
            const end = this.findIndexAtOffset(endOffset) ?? this.length - 1;
            range = {
                end: Math.max(start, end),
                start,
            };
        }
        return range;
    }

    forEachLayout(
        startIndex: number,
        endIndex: number,
        callback: (index: number, offset: number, size: number) => void,
    ) {
        const start = Math.max(0, startIndex);
        const end = Math.min(this.length - 1, endIndex);
        for (let index = start; index <= end; index++) {
            callback(index, this.getOffset(index), this.getSize(index));
        }
    }

    getColumn(index: number) {
        return this.columns[index] ?? 1;
    }

    getEstimatedSize() {
        return this.estimatedSize;
    }

    getMeasuredAverageSize() {
        return undefined;
    }

    getMeasuredCount() {
        return 0;
    }

    getOffset(index: number) {
        return this.offsets[index] ?? index * this.estimatedSize;
    }

    getStoredColumn(index: number) {
        return this.columns[index];
    }

    getStoredOffset(index: number) {
        return this.offsets[index];
    }

    getStoredSpan(index: number) {
        return this.spans[index];
    }

    getSize(index: number) {
        return this.sizes[index] ?? this.getCachedSize(index) ?? this.getInferredSize(index);
    }

    getSpan(index: number) {
        return this.spans[index] ?? 1;
    }

    getTotalSize() {
        if (this.length === 0) {
            return 0;
        }
        const lastIndex = this.length - 1;
        if (this.columns.length > 0) {
            let rowStart = lastIndex;
            while (rowStart > 0) {
                const column = this.columns[rowStart];
                if (column === 1 || column === undefined) {
                    break;
                }
                rowStart--;
            }

            let maxSize = 0;
            for (let index = rowStart; index <= lastIndex; index++) {
                maxSize = Math.max(maxSize, this.getSize(index));
            }
            return this.getOffset(rowStart) + maxSize;
        }
        return this.getOffset(lastIndex) + this.getSize(lastIndex);
    }

    hasIndex(index: number | undefined): index is number {
        return index !== undefined && Number.isInteger(index) && index >= 0 && index < this.length;
    }

    replaceKnownSizeEntries(entries: Array<{ index: number; size: number }>) {
        this.sizes.length = 0;
        for (const entry of entries) {
            this.setMeasuredSize(entry.index, entry.size);
        }
    }

    resize(length: number) {
        this.length = length;
    }

    setColumn(index: number, value: number | undefined) {
        this.columns[index] = value;
    }

    setEstimatedSize(size: number) {
        this.estimatedSize = size;
    }

    setMeasuredSize(index: number, size: number) {
        this.sizes[index] = size;
    }

    setOffset(index: number, value: number | undefined) {
        this.offsets[index] = value;
    }

    setSpan(index: number, value: number | undefined) {
        this.spans[index] = value;
    }

    private getInferredSize(index: number) {
        const offset = this.offsets[index];
        const nextOffset = this.offsets[index + 1];
        return offset !== undefined && nextOffset !== undefined ? nextOffset - offset : this.estimatedSize;
    }

    private getCachedSize(index: number) {
        const id = this.state.idCache[index] ?? getId(this.state, index);
        return this.state.sizes.get(id) ?? this.state.sizesKnown.get(id);
    }

    private findIndexAtOffset(offset: number) {
        for (let index = 0; index < this.length; index++) {
            if (this.getOffset(index) + this.getSize(index) > offset) {
                return index;
            }
        }
        return undefined;
    }
}

function resolveLayoutIndex(state: InternalState, key: unknown): number | undefined {
    if (typeof key === "number" && Number.isInteger(key)) {
        return key;
    }

    if (typeof key !== "string") {
        return undefined;
    }

    const fromIndexByKey = state.indexByKey?.get(key);
    if (fromIndexByKey !== undefined) {
        return fromIndexByKey;
    }

    const fromIdCache = state.idCache?.indexOf(key);
    if (typeof fromIdCache === "number" && fromIdCache >= 0) {
        return fromIdCache;
    }

    const keyExtractor = state.props?.keyExtractor;
    const data = state.props?.data;
    if (keyExtractor && Array.isArray(data)) {
        for (let i = 0; i < data.length; i++) {
            if (keyExtractor(data[i], i) === key) {
                return i;
            }
        }
    }

    const underMatch = /^item_(\d+)$/.exec(key);
    if (underMatch) {
        return Number(underMatch[1]);
    }

    const dashMatch = /^item-(\d+)$/.exec(key);
    if (dashMatch) {
        return Number(dashMatch[1]);
    }

    const bareMatch = /^item(\d+)$/.exec(key);
    if (bareMatch) {
        const n = Number(bareMatch[1]);
        return n > 0 ? n - 1 : 0;
    }

    return undefined;
}

function getOrCreateTestLayoutStore(state: InternalState) {
    let store = state.layoutStoreRuntime?.store as TestLayoutStore | undefined;
    const estimatedSize = state.props.estimatedItemSize ?? 100;
    if (!(store instanceof TestLayoutStore)) {
        store = new TestLayoutStore(state, state.props.data.length, estimatedSize);
        state.layoutStoreRuntime = new LayoutStoreRuntime(store as any, estimatedSize);
    }
    store.setEstimatedSize(estimatedSize);
    store.resize(Math.max(store.length, state.props.data.length));
    return store;
}

export function getLayoutValue(state: InternalState, field: LayoutField, key: unknown): number | undefined {
    const index = resolveLayoutIndex(state, key);
    if (index === undefined) {
        return undefined;
    }
    const store = state.layoutStoreRuntime?.store;
    if (!(store instanceof TestLayoutStore)) {
        return undefined;
    }
    if (field === "positions") {
        return store.getStoredOffset(index);
    }
    return field === "columns" ? store.getStoredColumn(index) : store.getStoredSpan(index);
}

export function setLayoutValue(state: InternalState, field: LayoutField, key: unknown, value: number | undefined) {
    const index = resolveLayoutIndex(state, key);
    if (index === undefined) {
        return;
    }
    const store = getOrCreateTestLayoutStore(state);
    store.resize(Math.max(store.length, index + 1));
    if (field === "positions") {
        store.setOffset(index, value);
    } else if (field === "columns") {
        store.setColumn(index, value);
    } else {
        store.setSpan(index, value);
    }
}

export function setLayoutValues(state: InternalState, field: LayoutField, values: Array<number | undefined> | null) {
    clearLayoutValues(state, field);
    if (values) {
        values.forEach((value, index) => setLayoutValue(state, field, index, value));
    }
}

export function hasLayoutValue(state: InternalState, field: LayoutField, key: unknown): boolean {
    return getLayoutValue(state, field, key) !== undefined;
}

export function clearLayoutValues(state: InternalState, field: LayoutField) {
    const store = getOrCreateTestLayoutStore(state);
    if (field === "positions") {
        store.resize(state.props.data.length);
        for (let index = 0; index < store.length; index++) {
            store.setOffset(index, undefined);
        }
    } else {
        for (let index = 0; index < store.length; index++) {
            if (field === "columns") {
                store.setColumn(index, undefined);
            } else {
                store.setSpan(index, undefined);
            }
        }
    }
}

export function countLayoutValues(state: InternalState, field: LayoutField): number {
    const store = state.layoutStoreRuntime?.store;
    if (!(store instanceof TestLayoutStore)) {
        return 0;
    }
    let count = 0;
    for (let index = 0; index < store.length; index++) {
        if (getLayoutValue(state, field, index) !== undefined) {
            count++;
        }
    }
    return count;
}
