import type { OffsetSearchLayoutEngine } from "@/core/LayoutEngine";
import { getSnapOffsetsForLayout } from "@/core/layoutSnapOffsets";
import type { PrefixLayoutStore } from "@/core/PrefixLayoutStore";
import { syncPrefixLayoutStoreTotalSize } from "@/core/prefixLayoutStoreLifecycle";
import type { StateContext } from "@/state/state";
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

    syncTotalSize() {
        return syncPrefixLayoutStoreTotalSize(this.ctx);
    }

    private isValidIndex(index: number | undefined): index is number {
        return index !== undefined && Number.isInteger(index) && index >= 0 && index < this.store.length;
    }
}
