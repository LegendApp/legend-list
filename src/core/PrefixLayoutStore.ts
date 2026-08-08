import {
    type LayoutIndexRange,
    type LayoutStoreSizeEntry,
    type MutableLayoutStore,
    validateKnownSizeEntryOrder,
} from "@/core/LayoutStore";

const PIECE_UNKNOWN = 0;
const PIECE_KNOWN = 1;
const SIZE_CACHED = 1;
const SIZE_MEASURED = 2;
const KNOWN_BLOCK_CAPACITY = 128;

type SizeKind = typeof SIZE_CACHED | typeof SIZE_MEASURED;

interface UnknownPiece {
    count: number;
    type: typeof PIECE_UNKNOWN;
}

interface KnownPiece {
    count: number;
    kinds: Uint8Array;
    knownSizeTotal: number;
    measuredCount: number;
    measuredSizeTotal: number;
    sizes: Float64Array;
    type: typeof PIECE_KNOWN;
}

type SequencePiece = KnownPiece | UnknownPiece;

interface SequenceNode {
    knownCount: number;
    knownSizeTotal: number;
    left?: SequenceNode;
    logicalCount: number;
    measuredCount: number;
    measuredSizeTotal: number;
    piece: SequencePiece;
    priority: number;
    right?: SequenceNode;
}

export type PrefixLayoutStoreSizeEntry = LayoutStoreSizeEntry;

export interface PrefixLayoutStoreDebugStats {
    allocatedKnownSlots: number;
    knownBlockCount: number;
    knownCount: number;
    nodeCount: number;
    unknownRunCount: number;
}

let nextNodeId = 1;

export class SparseSequenceLayoutStore implements MutableLayoutStore {
    private estimatedSize: number;
    private lengthValue: number;
    private root?: SequenceNode;

    constructor(length: number, estimatedSize: number) {
        this.lengthValue = normalizeLength(length);
        this.estimatedSize = normalizeSize(estimatedSize);
        this.root = createUnknownNode(this.lengthValue);
    }

    get length() {
        return this.lengthValue;
    }

    findIndexAtOffset(offset: number) {
        let index: number | undefined;
        if (this.length > 0 && !Number.isNaN(offset)) {
            let node = this.root;
            let logicalIndex = 0;
            let prefixSize = 0;
            while (node) {
                const leftSize = getEffectiveSize(node.left, this.estimatedSize);
                const leftEnd = prefixSize + leftSize;
                if (!isLessThanOrEqualOffset(leftEnd, offset)) {
                    if (node.left) {
                        node = node.left;
                    } else {
                        index = logicalIndex;
                        break;
                    }
                } else {
                    prefixSize = leftEnd;
                    logicalIndex += getLogicalCount(node.left);
                    const pieceSize = getPieceEffectiveSize(node.piece, this.estimatedSize);
                    const pieceEnd = prefixSize + pieceSize;
                    if (!isLessThanOrEqualOffset(pieceEnd, offset)) {
                        index = logicalIndex + findIndexInPiece(node.piece, prefixSize, offset, this.estimatedSize);
                        break;
                    }
                    prefixSize = pieceEnd;
                    logicalIndex += node.piece.count;
                    node = node.right;
                }
            }
        }
        return index;
    }

    findIndexRangeAtOffsets(startOffset: number, endOffset: number): LayoutIndexRange | undefined {
        let range: LayoutIndexRange | undefined;
        if (this.length > 0) {
            const start = this.findIndexAtOffset(startOffset) ?? this.length - 1;
            const end = this.findIndexAtOffset(endOffset) ?? this.length - 1;
            range = { end: Math.max(start, end), start };
        }
        return range;
    }

    clearKnownSizes() {
        this.root = createUnknownNode(this.length);
    }

    clearKnownSize(index: number) {
        this.assertIndex(index);
        const existing = this.getKnownValue(index);
        const didChange = existing !== undefined && existing.size !== this.estimatedSize;
        if (existing) {
            const [before, fromIndex] = splitTree(this.root, index);
            const [, after] = splitTree(fromIndex, 1);
            this.root = joinTrees(joinTrees(before, createUnknownNode(1)), after);
        }
        return didChange;
    }

    setEstimatedSize(estimatedSize: number) {
        this.estimatedSize = normalizeSize(estimatedSize);
    }

    getEstimatedSize() {
        return this.estimatedSize;
    }

    getMeasuredAverageSize() {
        const measuredCount = this.getMeasuredCount();
        return measuredCount > 0 ? getMeasuredSizeTotal(this.root) / measuredCount : undefined;
    }

    getMeasuredCount() {
        return getMeasuredCount(this.root);
    }

    getDebugStats(): PrefixLayoutStoreDebugStats {
        const stats: PrefixLayoutStoreDebugStats = {
            allocatedKnownSlots: 0,
            knownBlockCount: 0,
            knownCount: getKnownCount(this.root),
            nodeCount: 0,
            unknownRunCount: 0,
        };
        visitNodes(this.root, (node) => {
            stats.nodeCount++;
            if (node.piece.type === PIECE_KNOWN) {
                stats.knownBlockCount++;
                stats.allocatedKnownSlots += node.piece.sizes.length;
            } else {
                stats.unknownRunCount++;
            }
        });
        return stats;
    }

    hasIndex(index: number | undefined): index is number {
        return index !== undefined && Number.isInteger(index) && index >= 0 && index < this.length;
    }

    getOffset(index: number) {
        this.assertIndex(index);
        let node = this.root;
        let remaining = index;
        let offset = 0;
        while (node) {
            const leftCount = getLogicalCount(node.left);
            if (remaining < leftCount) {
                node = node.left;
            } else {
                offset += getEffectiveSize(node.left, this.estimatedSize);
                remaining -= leftCount;
                if (remaining < node.piece.count) {
                    offset += getPiecePrefixSize(node.piece, remaining, this.estimatedSize);
                    break;
                }
                offset += getPieceEffectiveSize(node.piece, this.estimatedSize);
                remaining -= node.piece.count;
                node = node.right;
            }
        }
        return offset;
    }

    getSize(index: number) {
        this.assertIndex(index);
        const located = findPieceAtIndex(this.root, index);
        return located?.node.piece.type === PIECE_KNOWN
            ? located.node.piece.sizes[located.offset]!
            : this.estimatedSize;
    }

    getTotalSize() {
        return getEffectiveSize(this.root, this.estimatedSize);
    }

    forEachLayout(
        startIndex: number,
        endIndex: number,
        callback: (index: number, offset: number, size: number) => void,
    ) {
        const start = Math.max(0, Math.trunc(startIndex));
        const end = Math.min(this.length - 1, Math.trunc(endIndex));
        if (start <= end) {
            let offset = this.getOffset(start);
            for (let index = start; index <= end; index++) {
                const size = this.getSize(index);
                callback(index, offset, size);
                offset += size;
            }
        }
    }

    replaceKnownSizeEntries(entries: readonly PrefixLayoutStoreSizeEntry[]) {
        for (const entry of entries) {
            this.assertIndex(entry.index);
            normalizeSize(entry.size);
        }
        if (!validateKnownSizeEntryOrder(entries)) {
            return false;
        }

        let root: SequenceNode | undefined;
        let cursor = 0;
        let entryIndex = 0;
        while (entryIndex < entries.length) {
            const first = entries[entryIndex]!;
            if (first.index > cursor) {
                root = joinTrees(root, createUnknownNode(first.index - cursor));
                cursor = first.index;
            }

            const blockEntries: Array<{ kind: SizeKind; size: number }> = [];
            while (
                entryIndex < entries.length &&
                entries[entryIndex]!.index === cursor &&
                blockEntries.length < KNOWN_BLOCK_CAPACITY
            ) {
                const entry = entries[entryIndex]!;
                blockEntries.push({
                    kind: entry.type === "measured" ? SIZE_MEASURED : SIZE_CACHED,
                    size: entry.size,
                });
                cursor++;
                entryIndex++;
            }
            root = joinTrees(root, createKnownNodeFromEntries(blockEntries));
        }
        if (cursor < this.length) {
            root = joinTrees(root, createUnknownNode(this.length - cursor));
        }
        this.root = root;
        return true;
    }

    invalidateRange(index: number, count: number) {
        assertMutationRange(this.length, index, count, "invalidateRange");
        if (count > 0) {
            const [before, fromIndex] = splitTree(this.root, index);
            const [, after] = splitTree(fromIndex, count);
            this.root = joinTrees(joinTrees(before, createUnknownNode(count)), after);
        }
    }

    move(from: number, to: number, count: number) {
        assertMoveRange(this.length, from, to, count);
        if (count > 0 && from !== to) {
            const [before, fromIndex] = splitTree(this.root, from);
            const [moved, after] = splitTree(fromIndex, count);
            const withoutMoved = joinTrees(before, after);
            const [atDestination, afterDestination] = splitTree(withoutMoved, to);
            this.root = joinTrees(joinTrees(atDestination, moved), afterDestination);
        }
    }

    resize(length: number) {
        const normalizedLength = normalizeLength(length);
        if (normalizedLength > this.length) {
            this.splice(this.length, 0, normalizedLength - this.length);
        } else if (normalizedLength < this.length) {
            this.splice(normalizedLength, this.length - normalizedLength, 0);
        }
    }

    splice(index: number, deleteCount: number, insertCount: number) {
        assertMutationRange(this.length, index, deleteCount, "splice");
        normalizeLength(insertCount);
        if (deleteCount > 0 || insertCount > 0) {
            const [before, fromIndex] = splitTree(this.root, index);
            const [, after] = splitTree(fromIndex, deleteCount);
            this.lengthValue += insertCount - deleteCount;
            this.root = joinTrees(joinTrees(before, createUnknownNode(insertCount)), after);
        }
    }

    setMeasuredSize(index: number, size: number) {
        this.assertIndex(index);
        const normalizedSize = normalizeSize(size);
        const located = findPieceAtIndex(this.root, index);
        const existingPiece = located?.node.piece;
        const existing =
            located && existingPiece?.type === PIECE_KNOWN
                ? {
                      kind: existingPiece.kinds[located.offset] as SizeKind,
                      size: existingPiece.sizes[located.offset]!,
                  }
                : undefined;
        const didChange = (existing?.size ?? this.estimatedSize) !== normalizedSize;
        if (located && existingPiece?.type === PIECE_KNOWN && existing) {
            if (existing.size !== normalizedSize || existing.kind !== SIZE_MEASURED) {
                const previousMeasuredSize = existing.kind === SIZE_MEASURED ? existing.size : 0;
                existingPiece.sizes[located.offset] = normalizedSize;
                existingPiece.kinds[located.offset] = SIZE_MEASURED;
                existingPiece.knownSizeTotal += normalizedSize - existing.size;
                existingPiece.measuredCount += existing.kind === SIZE_MEASURED ? 0 : 1;
                existingPiece.measuredSizeTotal += normalizedSize - previousMeasuredSize;
                updatePathToIndex(this.root, index);
            }
        } else if (!this.tryAppendMeasuredToPreviousBlock(index, normalizedSize, located)) {
            const [before, fromIndex] = splitTree(this.root, index);
            const [, after] = splitTree(fromIndex, 1);
            const measured = createKnownNodeFromEntries([{ kind: SIZE_MEASURED, size: normalizedSize }]);
            this.root = joinTrees(joinTrees(before, measured), after);
        }
        return didChange;
    }

    private assertIndex(index: number) {
        if (!this.hasIndex(index)) {
            throw new RangeError(`PrefixLayoutStore index ${index} is out of bounds for length ${this.length}`);
        }
    }

    private getKnownValue(index: number) {
        const located = findPieceAtIndex(this.root, index);
        const piece = located?.node.piece;
        return located && piece?.type === PIECE_KNOWN
            ? { kind: piece.kinds[located.offset] as SizeKind, size: piece.sizes[located.offset]! }
            : undefined;
    }

    private tryAppendMeasuredToPreviousBlock(
        index: number,
        size: number,
        current: ReturnType<typeof findPieceAtIndexWithPath>,
    ) {
        let didAppend = false;
        if (index > 0 && current) {
            const previous = findPieceAtIndexWithPath(this.root, index - 1);
            const currentPiece = current?.node.piece;
            const previousPiece = previous?.node.piece;
            if (
                current &&
                previous &&
                current.offset === 0 &&
                currentPiece?.type === PIECE_UNKNOWN &&
                currentPiece.count > 1 &&
                previousPiece?.type === PIECE_KNOWN &&
                previous.offset === previousPiece.count - 1 &&
                previousPiece.count < KNOWN_BLOCK_CAPACITY
            ) {
                ensureKnownPieceCapacity(previousPiece, previousPiece.count + 1);
                previousPiece.sizes[previousPiece.count] = size;
                previousPiece.kinds[previousPiece.count] = SIZE_MEASURED;
                previousPiece.count++;
                previousPiece.knownSizeTotal += size;
                previousPiece.measuredCount++;
                previousPiece.measuredSizeTotal += size;
                currentPiece.count--;
                updatePaths([previous.path, current.path]);
                didAppend = true;
            }
        }
        return didAppend;
    }
}

// Keep the existing internal name as the compatibility seam while the implementation is a
// packed implicit sparse sequence tree rather than an absolute-index prefix tree.
export class PrefixLayoutStore extends SparseSequenceLayoutStore {}

function createUnknownNode(count: number) {
    return count > 0 ? createNode({ count, type: PIECE_UNKNOWN }) : undefined;
}

function createKnownNodeFromEntries(entries: Array<{ kind: SizeKind; size: number }>) {
    let node: SequenceNode | undefined;
    if (entries.length > 0) {
        const sizes = new Float64Array(entries.length);
        const kinds = new Uint8Array(entries.length);
        for (let index = 0; index < entries.length; index++) {
            sizes[index] = entries[index]!.size;
            kinds[index] = entries[index]!.kind;
        }
        node = createNode(createKnownPiece(sizes, kinds, entries.length));
    }
    return node;
}

function createNode(piece: SequencePiece): SequenceNode {
    return updateNode({
        knownCount: 0,
        knownSizeTotal: 0,
        logicalCount: 0,
        measuredCount: 0,
        measuredSizeTotal: 0,
        piece,
        priority: getNodePriority(nextNodeId++),
    });
}

function updateNode(node: SequenceNode) {
    const pieceStats = getPieceStats(node.piece);
    node.logicalCount = getLogicalCount(node.left) + node.piece.count + getLogicalCount(node.right);
    node.knownCount = getKnownCount(node.left) + pieceStats.knownCount + getKnownCount(node.right);
    node.knownSizeTotal = getKnownSizeTotal(node.left) + pieceStats.knownSizeTotal + getKnownSizeTotal(node.right);
    node.measuredCount = getMeasuredCount(node.left) + pieceStats.measuredCount + getMeasuredCount(node.right);
    node.measuredSizeTotal =
        getMeasuredSizeTotal(node.left) + pieceStats.measuredSizeTotal + getMeasuredSizeTotal(node.right);
    return node;
}

function getPieceStats(piece: SequencePiece) {
    return piece.type === PIECE_KNOWN
        ? {
              knownCount: piece.count,
              knownSizeTotal: piece.knownSizeTotal,
              measuredCount: piece.measuredCount,
              measuredSizeTotal: piece.measuredSizeTotal,
          }
        : { knownCount: 0, knownSizeTotal: 0, measuredCount: 0, measuredSizeTotal: 0 };
}

function getLogicalCount(node: SequenceNode | undefined) {
    return node?.logicalCount ?? 0;
}

function getKnownCount(node: SequenceNode | undefined) {
    return node?.knownCount ?? 0;
}

function getKnownSizeTotal(node: SequenceNode | undefined) {
    return node?.knownSizeTotal ?? 0;
}

function getMeasuredCount(node: SequenceNode | undefined) {
    return node?.measuredCount ?? 0;
}

function getMeasuredSizeTotal(node: SequenceNode | undefined) {
    return node?.measuredSizeTotal ?? 0;
}

function getEffectiveSize(node: SequenceNode | undefined, estimatedSize: number) {
    return node ? node.knownSizeTotal + (node.logicalCount - node.knownCount) * estimatedSize : 0;
}

function getPieceEffectiveSize(piece: SequencePiece, estimatedSize: number) {
    let size = piece.count * estimatedSize;
    if (piece.type === PIECE_KNOWN) {
        size = piece.knownSizeTotal;
    }
    return size;
}

function getPiecePrefixSize(piece: SequencePiece, count: number, estimatedSize: number) {
    let size = count * estimatedSize;
    if (piece.type === PIECE_KNOWN) {
        size = 0;
        for (let index = 0; index < count; index++) {
            size += piece.sizes[index]!;
        }
    }
    return size;
}

function findPieceAtIndex(root: SequenceNode | undefined, index: number) {
    return findPieceAtIndexWithPath(root, index);
}

function findPieceAtIndexWithPath(root: SequenceNode | undefined, index: number) {
    let node = root;
    let remaining = index;
    const path: SequenceNode[] = [];
    let result: { node: SequenceNode; offset: number; path: SequenceNode[] } | undefined;
    while (node) {
        path.push(node);
        const leftCount = getLogicalCount(node.left);
        if (remaining < leftCount) {
            node = node.left;
        } else if (remaining < leftCount + node.piece.count) {
            result = { node, offset: remaining - leftCount, path };
            break;
        } else {
            remaining -= leftCount + node.piece.count;
            node = node.right;
        }
    }
    return result;
}

function updatePathToIndex(root: SequenceNode | undefined, index: number) {
    const located = findPieceAtIndexWithPath(root, index);
    if (located) {
        updatePaths([located.path]);
    }
}

function updatePaths(paths: SequenceNode[][]) {
    for (const path of paths) {
        for (let index = path.length - 1; index >= 0; index--) {
            updateNode(path[index]!);
        }
    }
}

function ensureKnownPieceCapacity(piece: KnownPiece, count: number) {
    if (piece.sizes.length < count) {
        const sizes = new Float64Array(KNOWN_BLOCK_CAPACITY);
        const kinds = new Uint8Array(KNOWN_BLOCK_CAPACITY);
        sizes.set(piece.sizes.subarray(0, piece.count));
        kinds.set(piece.kinds.subarray(0, piece.count));
        piece.sizes = sizes;
        piece.kinds = kinds;
    }
}

function findIndexInPiece(piece: SequencePiece, prefixSize: number, offset: number, estimatedSize: number) {
    let index = 0;
    if (piece.type === PIECE_KNOWN) {
        let end = prefixSize;
        for (let current = 0; current < piece.count; current++) {
            end += piece.sizes[current]!;
            if (!isLessThanOrEqualOffset(end, offset)) {
                index = current;
                break;
            }
        }
    } else if (estimatedSize > 0) {
        index = Math.max(0, Math.min(piece.count - 1, Math.floor((offset - prefixSize) / estimatedSize)));
        while (index < piece.count - 1 && isLessThanOrEqualOffset(prefixSize + (index + 1) * estimatedSize, offset)) {
            index++;
        }
        while (index > 0 && !isLessThanOrEqualOffset(prefixSize + index * estimatedSize, offset)) {
            index--;
        }
    }
    return index;
}

function splitTree(
    root: SequenceNode | undefined,
    leftLogicalCount: number,
): [SequenceNode | undefined, SequenceNode | undefined] {
    if (!root) {
        return [undefined, undefined];
    }

    const leftCount = getLogicalCount(root.left);
    if (leftLogicalCount < leftCount) {
        const [before, after] = splitTree(root.left, leftLogicalCount);
        root.left = after;
        return [before, updateNode(root)];
    }
    if (leftLogicalCount > leftCount + root.piece.count) {
        const [before, after] = splitTree(root.right, leftLogicalCount - leftCount - root.piece.count);
        root.right = before;
        return [updateNode(root), after];
    }
    if (leftLogicalCount === leftCount) {
        const before = root.left;
        root.left = undefined;
        return [before, updateNode(root)];
    }
    if (leftLogicalCount === leftCount + root.piece.count) {
        const after = root.right;
        root.right = undefined;
        return [updateNode(root), after];
    }

    const pieceOffset = leftLogicalCount - leftCount;
    const [leftPiece, rightPiece] = splitPiece(root.piece, pieceOffset);
    return [joinTrees(root.left, createNode(leftPiece)), joinTrees(createNode(rightPiece), root.right)];
}

function splitPiece(piece: SequencePiece, count: number): [SequencePiece, SequencePiece] {
    return piece.type === PIECE_UNKNOWN
        ? [
              { count, type: PIECE_UNKNOWN },
              { count: piece.count - count, type: PIECE_UNKNOWN },
          ]
        : [
              createKnownPiece(piece.sizes.slice(0, count), piece.kinds.slice(0, count), count),
              createKnownPiece(
                  piece.sizes.slice(count, piece.count),
                  piece.kinds.slice(count, piece.count),
                  piece.count - count,
              ),
          ];
}

function joinTrees(left: SequenceNode | undefined, right: SequenceNode | undefined): SequenceNode | undefined {
    if (!left) {
        return right;
    }
    if (!right) {
        return left;
    }

    const [leftRest, last] = popRightNode(left);
    const [first, rightRest] = popLeftNode(right);
    const mergedPiece = mergePieces(last.piece, first.piece);
    if (mergedPiece) {
        last.piece = mergedPiece;
        return joinTrees(joinTrees(leftRest, updateNode(last)), rightRest);
    }
    return mergeTreesRaw(mergeTreesRaw(leftRest, last), mergeTreesRaw(first, rightRest));
}

function mergePieces(left: SequencePiece, right: SequencePiece) {
    let merged: SequencePiece | undefined;
    if (left.type === PIECE_UNKNOWN && right.type === PIECE_UNKNOWN) {
        merged = { count: left.count + right.count, type: PIECE_UNKNOWN };
    } else if (
        left.type === PIECE_KNOWN &&
        right.type === PIECE_KNOWN &&
        left.count + right.count <= KNOWN_BLOCK_CAPACITY
    ) {
        const count = left.count + right.count;
        let sizes = left.sizes;
        let kinds = left.kinds;
        if (sizes.length < count) {
            sizes = new Float64Array(KNOWN_BLOCK_CAPACITY);
            kinds = new Uint8Array(KNOWN_BLOCK_CAPACITY);
            sizes.set(left.sizes.subarray(0, left.count));
            kinds.set(left.kinds.subarray(0, left.count));
        }
        sizes.set(right.sizes.subarray(0, right.count), left.count);
        kinds.set(right.kinds.subarray(0, right.count), left.count);
        merged = {
            count,
            kinds,
            knownSizeTotal: left.knownSizeTotal + right.knownSizeTotal,
            measuredCount: left.measuredCount + right.measuredCount,
            measuredSizeTotal: left.measuredSizeTotal + right.measuredSizeTotal,
            sizes,
            type: PIECE_KNOWN,
        };
    }
    return merged;
}

function createKnownPiece(sizes: Float64Array, kinds: Uint8Array, count: number): KnownPiece {
    let knownSizeTotal = 0;
    let measuredCount = 0;
    let measuredSizeTotal = 0;
    for (let index = 0; index < count; index++) {
        const size = sizes[index]!;
        knownSizeTotal += size;
        if (kinds[index] === SIZE_MEASURED) {
            measuredCount++;
            measuredSizeTotal += size;
        }
    }
    return {
        count,
        kinds,
        knownSizeTotal,
        measuredCount,
        measuredSizeTotal,
        sizes,
        type: PIECE_KNOWN,
    };
}

function mergeTreesRaw(left: SequenceNode | undefined, right: SequenceNode | undefined): SequenceNode | undefined {
    let root: SequenceNode | undefined;
    if (!left) {
        root = right;
    } else if (!right) {
        root = left;
    } else if (left.priority < right.priority) {
        left.right = mergeTreesRaw(left.right, right);
        root = updateNode(left);
    } else {
        right.left = mergeTreesRaw(left, right.left);
        root = updateNode(right);
    }
    return root;
}

function popRightNode(root: SequenceNode): [SequenceNode | undefined, SequenceNode] {
    if (root.right) {
        const [remainingRight, last] = popRightNode(root.right);
        root.right = remainingRight;
        return [updateNode(root), last];
    }
    const remainingTree = root.left;
    root.left = undefined;
    root.right = undefined;
    return [remainingTree, updateNode(root)];
}

function popLeftNode(root: SequenceNode): [SequenceNode, SequenceNode | undefined] {
    if (root.left) {
        const [first, remainingLeft] = popLeftNode(root.left);
        root.left = remainingLeft;
        return [first, updateNode(root)];
    }
    const remainingTree = root.right;
    root.left = undefined;
    root.right = undefined;
    return [updateNode(root), remainingTree];
}

function visitNodes(node: SequenceNode | undefined, visit: (current: SequenceNode) => void) {
    if (node) {
        visitNodes(node.left, visit);
        visit(node);
        visitNodes(node.right, visit);
    }
}

function getNodePriority(id: number) {
    let value = (id + 0x9e3779b9) >>> 0;
    value = Math.imul(value ^ (value >>> 16), 0x85ebca6b) >>> 0;
    value = Math.imul(value ^ (value >>> 13), 0xc2b2ae35) >>> 0;
    return (value ^ (value >>> 16)) >>> 0;
}

function assertMoveRange(length: number, from: number, to: number, count: number) {
    assertMutationRange(length, from, count, "move");
    if (!Number.isInteger(to) || to < 0 || to > length - count) {
        throw new RangeError(
            `PrefixLayoutStore move destination ${to} is invalid for length ${length} and count ${count}`,
        );
    }
}

function assertMutationRange(length: number, index: number, count: number, operation: string) {
    if (!Number.isInteger(index) || !Number.isInteger(count) || index < 0 || count < 0 || index + count > length) {
        throw new RangeError(`PrefixLayoutStore ${operation} range ${index}:${count} is invalid for length ${length}`);
    }
}

function normalizeLength(length: number) {
    if (!Number.isInteger(length) || length < 0) {
        throw new RangeError(`PrefixLayoutStore length must be a non-negative integer. Received ${length}`);
    }
    return length;
}

function normalizeSize(size: number) {
    if (!Number.isFinite(size) || size < 0) {
        throw new RangeError(`Layout size must be a finite non-negative number. Received ${size}`);
    }
    return size;
}

function isLessThanOrEqualOffset(prefixSize: number, offset: number) {
    return (
        prefixSize <= offset ||
        (Number.isFinite(prefixSize) &&
            Number.isFinite(offset) &&
            Math.abs(prefixSize - offset) <= Number.EPSILON * Math.max(1, Math.abs(prefixSize), Math.abs(offset)) * 16)
    );
}
