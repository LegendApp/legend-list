import type { StateContext } from "../../src/state/state";
import { getItemSizeAtIndex } from "../../src/utils/getItemSize";

export interface LayoutReader {
    findIndexAtOffset(offset: number): number | undefined;
    getEnd(index: number): number | undefined;
    getOffset(index: number): number | undefined;
    getSize(index: number): number | undefined;
    getTotalSize(): number;
}

function isValidIndex(ctx: StateContext, index: number) {
    return Number.isInteger(index) && index >= 0 && index < ctx.state.props.data.length;
}

export function createCurrentLayoutReader(ctx: StateContext): LayoutReader {
    const reader: LayoutReader = {
        findIndexAtOffset(offset) {
            let match: number | undefined;
            const dataLength = ctx.state.props.data.length;
            for (let index = 0; index < dataLength; index++) {
                const end = reader.getEnd(index);
                if (end !== undefined && end > offset) {
                    match = index;
                    break;
                }
            }
            return match;
        },
        getEnd(index) {
            let end: number | undefined;
            const offset = reader.getOffset(index);
            const size = reader.getSize(index);
            if (offset !== undefined && size !== undefined) {
                end = offset + size;
            }
            return end;
        },
        getOffset(index) {
            let offset: number | undefined;
            if (isValidIndex(ctx, index)) {
                offset = ctx.state.positions[index];
            }
            return offset;
        },
        getSize(index) {
            let size: number | undefined;
            if (isValidIndex(ctx, index)) {
                size = getItemSizeAtIndex(ctx, index);
            }
            return size;
        },
        getTotalSize() {
            return ctx.state.totalSize;
        },
    };

    return reader;
}
