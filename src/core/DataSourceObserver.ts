import type { DataSourceMutationBatch, DataSourceOperation, LegendListDataSource } from "@/types.base";

export interface DataSourceResetInfo {
    batch: DataSourceMutationBatch;
    reason: string;
}

interface DataSourceSnapshot {
    length: number;
    revision: number;
}

interface DataSourceObserverCallbacks {
    onBatch: (batch: DataSourceMutationBatch) => void;
    onReset: (info: DataSourceResetInfo) => void;
}

function isNonNegativeInteger(value: number) {
    return Number.isInteger(value) && value >= 0;
}

function validateOperation(operation: DataSourceOperation, length: number) {
    let nextLength = length;
    let reason: string | undefined;

    if (operation.type === "splice") {
        if (
            !isNonNegativeInteger(operation.index) ||
            !isNonNegativeInteger(operation.deleteCount) ||
            !isNonNegativeInteger(operation.insertCount) ||
            operation.index > length ||
            operation.index + operation.deleteCount > length
        ) {
            reason = "splice range is invalid";
        } else {
            nextLength = length - operation.deleteCount + operation.insertCount;
        }
    } else if (operation.type === "move") {
        if (
            !isNonNegativeInteger(operation.from) ||
            !isNonNegativeInteger(operation.to) ||
            !isNonNegativeInteger(operation.count) ||
            operation.from + operation.count > length ||
            operation.to > length - operation.count
        ) {
            reason = "move range is invalid";
        }
    } else if (operation.type === "update") {
        if (
            !isNonNegativeInteger(operation.index) ||
            !isNonNegativeInteger(operation.count) ||
            operation.index + operation.count > length
        ) {
            reason = "update range is invalid";
        }
    }

    return { nextLength, reason };
}

export function validateDataSourceMutationBatch(
    source: LegendListDataSource<unknown>,
    batch: DataSourceMutationBatch,
    expectedRevision: number,
    expectedLength: number,
) {
    let reason: string | undefined;
    let nextLength = expectedLength;

    if (batch.previousRevision !== expectedRevision || batch.revision <= batch.previousRevision) {
        reason = "revision sequence is invalid";
    } else if (batch.previousLength !== expectedLength) {
        reason = "previous length does not match the observed source";
    } else if (!isNonNegativeInteger(batch.length)) {
        reason = "next length is invalid";
    } else if (source.getRevision() !== batch.revision || source.getLength() !== batch.length) {
        reason = "batch does not match the readable source state";
    } else {
        const resetOperations = batch.operations.filter((operation) => operation.type === "reset");
        if (resetOperations.length > 0) {
            if (batch.operations.length !== 1) {
                reason = "reset must be the only operation in a batch";
            } else {
                nextLength = batch.length;
            }
        } else {
            for (const operation of batch.operations) {
                const result = validateOperation(operation, nextLength);
                nextLength = result.nextLength;
                if (result.reason) {
                    reason = result.reason;
                    break;
                }
            }
            if (!reason && nextLength !== batch.length) {
                reason = "operation lengths do not produce the declared next length";
            }
        }
    }

    return reason;
}

export class DataSourceObserver {
    private length: number;
    private revision: number;
    private unsubscribe?: () => void;

    constructor(
        private readonly source: LegendListDataSource<unknown>,
        private readonly callbacks: DataSourceObserverCallbacks,
        snapshot?: DataSourceSnapshot,
    ) {
        this.length = snapshot?.length ?? source.getLength();
        this.revision = snapshot?.revision ?? source.getRevision();
    }

    start() {
        if (!this.unsubscribe) {
            this.unsubscribe = this.source.subscribe((batch) => {
                const reason = validateDataSourceMutationBatch(this.source, batch, this.revision, this.length);
                this.length = this.source.getLength();
                this.revision = this.source.getRevision();
                if (reason) {
                    this.callbacks.onReset({ batch, reason });
                } else {
                    this.callbacks.onBatch(batch);
                }
            });

            const currentLength = this.source.getLength();
            const currentRevision = this.source.getRevision();
            if (currentLength !== this.length || currentRevision !== this.revision) {
                const batch: DataSourceMutationBatch = {
                    length: currentLength,
                    operations: [{ type: "reset" }],
                    previousLength: this.length,
                    previousRevision: this.revision,
                    revision: currentRevision,
                };
                this.length = currentLength;
                this.revision = currentRevision;
                this.callbacks.onReset({
                    batch,
                    reason: "source changed before its subscription became active",
                });
            }
        }
        return () => this.stop();
    }

    stop() {
        const unsubscribe = this.unsubscribe;
        this.unsubscribe = undefined;
        unsubscribe?.();
    }
}
