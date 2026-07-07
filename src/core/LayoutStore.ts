export interface LayoutIndexRange {
    end: number;
    start: number;
}

export interface LayoutStoreSizeEntry {
    index: number;
    size: number;
    type: "cached" | "measured";
}

export interface LayoutStore {
    readonly length: number;
    findIndexRangeAtOffsets(startOffset: number, endOffset: number): LayoutIndexRange | undefined;
    forEachLayout(
        startIndex: number,
        endIndex: number,
        callback: (index: number, offset: number, size: number) => void,
    ): void;
    getOffset(index: number): number;
    getSize(index: number): number;
    getTotalSize(): number;
    hasIndex(index: number | undefined): index is number;
}
