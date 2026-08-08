import { IS_DEV } from "@/utils/devEnvironment";

export interface LayoutIndexRange {
    end: number;
    start: number;
}

export interface LayoutStoreSizeEntry {
    /** Entries passed to bulk replacement must have strictly increasing, unique indexes. */
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

export interface MutableLayoutStore extends LayoutStore {
    invalidateRange(index: number, count: number): void;
    move(from: number, to: number, count: number): void;
    replaceKnownSizeEntries(entries: readonly LayoutStoreSizeEntry[]): boolean;
    splice(index: number, deleteCount: number, insertCount: number): void;
}

export function validateKnownSizeEntryOrder(entries: readonly LayoutStoreSizeEntry[]) {
    let previousIndex = -1;
    for (const entry of entries) {
        if (entry.index <= previousIndex) {
            if (IS_DEV) {
                console.error(
                    `[legend-list] replaceKnownSizeEntries requires strictly increasing, unique indexes. Received ${entry.index} after ${previousIndex}.`,
                );
            }
            return false;
        }
        previousIndex = entry.index;
    }
    return true;
}
