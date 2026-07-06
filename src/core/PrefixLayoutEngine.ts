import { addTotalSize } from "@/core/addTotalSize";
import type { OffsetSearchLayoutEngine } from "@/core/LayoutEngine";
import { getSnapOffsetsForLayout, syncSnapOffsetsForLayout } from "@/core/layoutSnapOffsets";
import type { PrefixLayoutStore } from "@/core/PrefixLayoutStore";
import { notifyPosition$, type StateContext } from "@/state/state";
import type { InternalState } from "@/types.internal";

export class PrefixLayoutEngine implements OffsetSearchLayoutEngine {
    readonly kind = "prefix";

    constructor(
        private ctx: StateContext,
        private store: PrefixLayoutStore,
        private state: InternalState = ctx.state,
    ) {}

    findIndexAtOffset(offset: number) {
        return this.store.length > 0 ? this.store.findIndexAtOffset(offset) : undefined;
    }

    getEnd(index: number | undefined) {
        let end: number | undefined;
        if (this.isValidIndex(index)) {
            end = this.store.getEnd(index);
        }
        return end;
    }

    getOffset(index: number | undefined) {
        let offset: number | undefined;
        if (this.isValidIndex(index)) {
            offset = this.store.getOffset(index);
        }
        return offset;
    }

    getSize(index: number | undefined) {
        let size: number | undefined;
        if (this.isValidIndex(index)) {
            size = this.store.getSize(index);
        }
        return size;
    }

    getSnapOffsets(indices: number[]) {
        return getSnapOffsetsForLayout(this.ctx, indices, (index) => this.getOffset(index));
    }

    getTotalSize() {
        return this.store.getTotalSize();
    }

    recordMeasuredSize(index: number | undefined, key: string, size: number) {
        let didRecord = false;
        if (this.isValidIndex(index)) {
            this.store.setMeasuredSize(index, size);
            this.state.sizesKnown.set(key, size);
            this.state.sizes.set(key, size);
            this.syncTotalSize();
            didRecord = true;
        }
        return didRecord;
    }

    syncTotalSize() {
        addTotalSize(this.ctx, null, this.store.getTotalSize());
        this.syncSnapOffsets();
        this.notifyPositionListeners();
        return true;
    }

    private isValidIndex(index: number | undefined): index is number {
        return index !== undefined && Number.isInteger(index) && index >= 0 && index < this.store.length;
    }

    private notifyPositionListeners() {
        if (this.ctx.positionListeners.size > 0) {
            for (const [key] of this.ctx.positionListeners) {
                const index = this.state.indexByKey.get(key);
                if (this.isValidIndex(index)) {
                    this.notifyPosition(key, this.store.getOffset(index));
                }
            }
        }
    }

    private notifyPosition(key: string, offset: number) {
        let offsets = this.state.layoutStorePositionListenerOffsets;
        if (!offsets) {
            offsets = new Map();
            this.state.layoutStorePositionListenerOffsets = offsets;
        }
        if (offsets.get(key) !== offset) {
            offsets.set(key, offset);
            notifyPosition$(this.ctx, key, offset);
        }
    }

    private syncSnapOffsets() {
        const snapToIndices = this.state.props.snapToIndices;
        if (snapToIndices) {
            syncSnapOffsetsForLayout(this.ctx, snapToIndices, (index) => this.getOffset(index));
        }
    }
}
