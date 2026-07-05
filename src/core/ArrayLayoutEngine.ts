import type { LayoutEngine } from "@/core/LayoutEngine";
import { getSnapOffsetsForLayout } from "@/core/layoutSnapOffsets";
import { setSize } from "@/core/setSize";
import { updateTotalSize } from "@/core/updateTotalSize";
import type { StateContext } from "@/state/state";
import type { InternalState } from "@/types.internal";
import { getId } from "@/utils/getId";
import { getItemSize } from "@/utils/getItemSize";

export class ArrayLayoutEngine implements LayoutEngine {
    readonly kind = "array";

    constructor(
        private ctx: StateContext,
        private state: InternalState = ctx.state,
    ) {}

    findIndexAtOffset(offset: number) {
        let match: number | undefined;
        const dataLength = this.state.props.data.length;
        for (let index = 0; index < dataLength; index++) {
            const end = this.getEnd(index);
            if (end !== undefined && end > offset) {
                match = index;
                break;
            }
        }
        return match;
    }

    getEnd(index: number | undefined) {
        const offset = this.getOffset(index);
        const size = this.getSize(index);
        return offset !== undefined && size !== undefined ? offset + size : undefined;
    }

    getOffset(index: number | undefined) {
        let offset: number | undefined;
        if (this.isValidIndex(index)) {
            offset = this.state.positions[index];
        }
        return offset;
    }

    getSize(index: number | undefined) {
        let size: number | undefined;
        if (this.isValidIndex(index)) {
            const id = this.state.idCache[index] ?? getId(this.state, index);
            size = this.state.sizes.get(id) ?? getItemSize(this.ctx, id, index, this.state.props.data[index]);
        }
        return size;
    }

    getSnapOffsets(indices: number[]) {
        return getSnapOffsetsForLayout(this.ctx, indices, (index) => this.getOffset(index));
    }

    getTotalSize() {
        return this.state.totalSize;
    }

    recordMeasuredSize(index: number | undefined, key: string, size: number) {
        let didRecord = false;
        if (this.isValidIndex(index)) {
            this.state.sizesKnown.set(key, size);
            setSize(this.ctx, key, size);
            didRecord = true;
        }
        return didRecord;
    }

    syncTotalSize() {
        updateTotalSize(this.ctx);
        return true;
    }

    private isValidIndex(index: number | undefined): index is number {
        return index !== undefined && Number.isInteger(index) && index >= 0 && index < this.state.props.data.length;
    }
}
