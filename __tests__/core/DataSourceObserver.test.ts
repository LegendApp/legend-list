import { describe, expect, it, mock } from "bun:test";
import "../setup";

import { DataSourceObserver } from "../../src/core/DataSourceObserver";
import type { DataSourceMutationBatch, LegendListDataSource } from "../../src/types.base";

function createMutableSource(initialLength = 3) {
    let length = initialLength;
    let revision = 0;
    let listener: ((batch: DataSourceMutationBatch) => void) | undefined;
    const unsubscribe = mock(() => {});
    const source: LegendListDataSource<number> = {
        getItem: (index) => index,
        getKey: (index) => `item-${index}`,
        getLength: () => length,
        getRevision: () => revision,
        subscribe: (nextListener) => {
            listener = nextListener;
            return unsubscribe;
        },
    };

    return {
        emit(batch: DataSourceMutationBatch) {
            length = batch.length;
            revision = batch.revision;
            listener?.(batch);
        },
        source,
        unsubscribe,
    };
}

describe("DataSourceObserver", () => {
    it("forwards valid sequential mutation batches", () => {
        const mutable = createMutableSource();
        const onBatch = mock(() => {});
        const onReset = mock(() => {});
        const observer = new DataSourceObserver(mutable.source, { onBatch, onReset });
        observer.start();

        const batch: DataSourceMutationBatch = {
            length: 4,
            operations: [{ deleteCount: 0, index: 1, insertCount: 1, type: "splice" }],
            previousLength: 3,
            previousRevision: 0,
            revision: 1,
        };
        mutable.emit(batch);

        expect(onBatch).toHaveBeenCalledWith(batch);
        expect(onReset).not.toHaveBeenCalled();
    });

    it("uses the reset callback when a revision is missed", () => {
        const mutable = createMutableSource();
        const onBatch = mock(() => {});
        const onReset = mock(() => {});
        const observer = new DataSourceObserver(mutable.source, { onBatch, onReset });
        observer.start();

        const batch: DataSourceMutationBatch = {
            length: 4,
            operations: [{ deleteCount: 0, index: 3, insertCount: 1, type: "splice" }],
            previousLength: 3,
            previousRevision: 4,
            revision: 5,
        };
        mutable.emit(batch);

        expect(onBatch).not.toHaveBeenCalled();
        expect(onReset.mock.calls[0]?.[0].reason).toBe("revision sequence is invalid");
    });

    it("uses the reset callback when the source changes before subscription starts", () => {
        const mutable = createMutableSource();
        const onReset = mock(() => {});
        const observer = new DataSourceObserver(
            mutable.source,
            { onBatch: () => {}, onReset },
            { length: 2, revision: -1 },
        );

        observer.start();

        expect(onReset.mock.calls[0]?.[0].reason).toBe("source changed before its subscription became active");
        expect(onReset.mock.calls[0]?.[0].batch.operations).toEqual([{ type: "reset" }]);
    });

    it("rejects contradictory operation lengths and ranges", () => {
        const mutable = createMutableSource();
        const onReset = mock(() => {});
        const observer = new DataSourceObserver(mutable.source, { onBatch: () => {}, onReset });
        observer.start();

        mutable.emit({
            length: 4,
            operations: [{ deleteCount: 1, index: 3, insertCount: 1, type: "splice" }],
            previousLength: 3,
            previousRevision: 0,
            revision: 1,
        });

        expect(onReset.mock.calls[0]?.[0].reason).toBe("splice range is invalid");
    });

    it("allows reset only as a standalone operation", () => {
        const mutable = createMutableSource();
        const onReset = mock(() => {});
        const observer = new DataSourceObserver(mutable.source, { onBatch: () => {}, onReset });
        observer.start();

        mutable.emit({
            length: 3,
            operations: [{ type: "reset" }, { count: 1, index: 0, layout: "preserve", type: "update" }],
            previousLength: 3,
            previousRevision: 0,
            revision: 1,
        });

        expect(onReset.mock.calls[0]?.[0].reason).toBe("reset must be the only operation in a batch");
    });

    it("unsubscribes exactly once", () => {
        const mutable = createMutableSource();
        const observer = new DataSourceObserver(mutable.source, { onBatch: () => {}, onReset: () => {} });
        const stop = observer.start();

        stop();
        observer.stop();

        expect(mutable.unsubscribe).toHaveBeenCalledTimes(1);
    });
});
