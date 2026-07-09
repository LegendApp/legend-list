import type { DataSourceMutationBatch, DataSourceOperation, LegendListDataSource } from "@legendapp/list/react-native";

type GeneratedPiece = {
    count: number;
    kind: "generated";
    start: number;
};

type ItemPiece = {
    keys: string[];
    kind: "items";
};

type Piece = GeneratedPiece | ItemPiece;

export class MutationDataSource<ItemT extends object> implements LegendListDataSource<ItemT> {
    private readonly generatedItemFactory: (originalIndex: number) => ItemT;
    private readonly generatedKeyPrefix: string;
    private readonly itemByKey = new Map<string, ItemT>();
    private readonly listeners = new Set<(batch: DataSourceMutationBatch) => void>();
    private pieces: Piece[];
    private revision = 0;

    constructor(options: {
        generatedItemFactory: (originalIndex: number) => ItemT;
        generatedKeyPrefix: string;
        length: number;
    }) {
        this.generatedItemFactory = options.generatedItemFactory;
        this.generatedKeyPrefix = options.generatedKeyPrefix;
        this.pieces = options.length > 0 ? [{ count: options.length, kind: "generated", start: 0 }] : [];
    }

    getItem(index: number) {
        const resolved = this.resolveIndex(index);
        const key = getPieceKey(resolved.piece, resolved.offset, this.generatedKeyPrefix);
        let item = this.itemByKey.get(key);
        if (!item && resolved.piece.kind === "generated") {
            item = this.generatedItemFactory(resolved.piece.start + resolved.offset);
            this.itemByKey.set(key, item);
        }
        return item;
    }

    getKey(index: number) {
        const resolved = this.resolveIndex(index);
        return getPieceKey(resolved.piece, resolved.offset, this.generatedKeyPrefix);
    }

    getLength() {
        return this.pieces.reduce((total, piece) => total + getPieceLength(piece), 0);
    }

    getRevision() {
        return this.revision;
    }

    move(from: number, to: number, count: number) {
        const previousLength = this.getLength();
        assertRange(previousLength, from, count);
        if (!Number.isInteger(to) || to < 0 || to > previousLength - count) {
            throw new RangeError(`move destination ${to} is outside the post-removal length ${previousLength - count}`);
        }
        if (count > 0 && from !== to) {
            const [before, fromAndAfter] = splitPieces(this.pieces, from);
            const [moved, after] = splitPieces(fromAndAfter, count);
            const withoutMoved = compactPieces([...before, ...after]);
            const [atDestination, afterDestination] = splitPieces(withoutMoved, to);
            this.pieces = compactPieces([...atDestination, ...moved, ...afterDestination]);
            this.emit(previousLength, [{ count, from, to, type: "move" }]);
        }
    }

    splice(index: number, deleteCount: number, items: Array<{ item: ItemT; key: string }>) {
        const previousLength = this.getLength();
        assertRange(previousLength, index, deleteCount);
        const [before, fromIndex] = splitPieces(this.pieces, index);
        const [, after] = splitPieces(fromIndex, deleteCount);
        const insertedKeys = items.map(({ item, key }) => {
            this.itemByKey.set(key, item);
            return key;
        });
        const insertCount = insertedKeys.length;
        const inserted: Piece[] = insertedKeys.length > 0 ? [{ keys: insertedKeys, kind: "items" }] : [];
        this.pieces = compactPieces([...before, ...inserted, ...after]);
        this.emit(previousLength, [{ deleteCount, index, insertCount, type: "splice" }]);
    }

    subscribe(listener: (batch: DataSourceMutationBatch) => void) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    update(index: number, item: ItemT, layout: "invalidate" | "preserve") {
        const length = this.getLength();
        assertRange(length, index, 1);
        this.itemByKey.set(this.getKey(index), item);
        this.emit(length, [{ count: 1, index, layout, type: "update" }]);
    }

    private emit(previousLength: number, operations: DataSourceOperation[]) {
        const previousRevision = this.revision;
        this.revision++;
        const batch: DataSourceMutationBatch = {
            length: this.getLength(),
            operations,
            previousLength,
            previousRevision,
            revision: this.revision,
        };
        for (const listener of this.listeners) {
            listener(batch);
        }
    }

    private resolveIndex(index: number) {
        const length = this.getLength();
        assertRange(length, index, 1);
        let remaining = index;
        let resolved: { offset: number; piece: Piece } | undefined;
        for (const piece of this.pieces) {
            const pieceLength = getPieceLength(piece);
            if (remaining < pieceLength) {
                resolved = { offset: remaining, piece };
                break;
            }
            remaining -= pieceLength;
        }
        return resolved!;
    }
}

function assertRange(length: number, index: number, count: number) {
    if (!Number.isInteger(index) || !Number.isInteger(count) || index < 0 || count < 0 || index + count > length) {
        throw new RangeError(`range ${index}:${count} is outside length ${length}`);
    }
}

function compactPieces(pieces: Piece[]) {
    const compacted: Piece[] = [];
    for (const piece of pieces) {
        if (getPieceLength(piece) > 0) {
            const previous = compacted[compacted.length - 1];
            if (
                previous?.kind === "generated" &&
                piece.kind === "generated" &&
                previous.start + previous.count === piece.start
            ) {
                previous.count += piece.count;
            } else if (previous?.kind === "items" && piece.kind === "items") {
                for (const key of piece.keys) {
                    previous.keys.push(key);
                }
            } else {
                compacted.push(piece);
            }
        }
    }
    return compacted;
}

function getPieceKey(piece: Piece, offset: number, generatedKeyPrefix: string) {
    return piece.kind === "generated" ? `${generatedKeyPrefix}${piece.start + offset}` : piece.keys[offset]!;
}

function getPieceLength(piece: Piece) {
    return piece.kind === "generated" ? piece.count : piece.keys.length;
}

function splitPieces(pieces: Piece[], index: number): [Piece[], Piece[]] {
    const before: Piece[] = [];
    const after: Piece[] = [];
    let remaining = index;
    for (const piece of pieces) {
        const pieceLength = getPieceLength(piece);
        if (remaining >= pieceLength) {
            before.push(piece);
            remaining -= pieceLength;
        } else if (remaining <= 0) {
            after.push(piece);
        } else if (piece.kind === "generated") {
            before.push({ count: remaining, kind: "generated", start: piece.start });
            after.push({ count: piece.count - remaining, kind: "generated", start: piece.start + remaining });
            remaining = 0;
        } else {
            before.push({ keys: piece.keys.slice(0, remaining), kind: "items" });
            after.push({ keys: piece.keys.slice(remaining), kind: "items" });
            remaining = 0;
        }
    }
    return [before, after];
}
