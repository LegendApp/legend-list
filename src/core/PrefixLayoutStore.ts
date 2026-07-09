import type { LayoutIndexRange, LayoutStore, LayoutStoreSizeEntry } from "@/core/LayoutStore";

const SIZE_CACHED = 1;
const SIZE_MEASURED = 2;

type SizeKind = typeof SIZE_CACHED | typeof SIZE_MEASURED;

export type PrefixLayoutStoreSizeEntry = LayoutStoreSizeEntry;

interface PrefixStats {
    knownCount: number;
    measuredCount: number;
    measuredSizeTotal: number;
    sizeTotal: number;
}

interface KnownSizeNode extends PrefixStats {
    index: number;
    kind: SizeKind;
    left?: KnownSizeNode;
    priority: number;
    right?: KnownSizeNode;
    size: number;
}

export class PrefixLayoutStore implements LayoutStore {
    // Prefix mode intentionally uses one scalar estimate for all unknown rows.
    // Known rows are sparse nodes that store measured/cached deviations from the estimate.
    private estimatedSize: number;
    private lengthValue: number;
    private root?: KnownSizeNode;

    constructor(length: number, estimatedSize: number) {
        this.lengthValue = normalizeLength(length);
        this.estimatedSize = normalizeSize(estimatedSize);
    }

    get length() {
        return this.lengthValue;
    }

    findIndexAtOffset(offset: number) {
        let index: number | undefined;
        if (this.length > 0 && !Number.isNaN(offset)) {
            index = findIndexAtOffsetInRange(this.root, 0, this.length, 0, offset, this.estimatedSize);
        }
        return index;
    }

    findIndexRangeAtOffsets(startOffset: number, endOffset: number): LayoutIndexRange | undefined {
        let range: LayoutIndexRange | undefined;
        if (this.length > 0) {
            const start = this.findIndexAtOffset(startOffset) ?? this.length - 1;
            const end = this.findIndexAtOffset(endOffset) ?? this.length - 1;
            range = {
                end: Math.max(start, end),
                start,
            };
        }
        return range;
    }

    clearKnownSizes() {
        this.root = undefined;
    }

    setEstimatedSize(estimatedSize: number) {
        this.estimatedSize = normalizeSize(estimatedSize);
    }

    getEstimatedSize() {
        return this.estimatedSize;
    }

    getMeasuredAverageSize() {
        const measuredCount = this.getMeasuredCount();
        return measuredCount > 0 ? getNodeMeasuredSizeTotal(this.root) / measuredCount : undefined;
    }

    getMeasuredCount() {
        return getNodeMeasuredCount(this.root);
    }

    hasIndex(index: number | undefined): index is number {
        return index !== undefined && Number.isInteger(index) && index >= 0 && index < this.length;
    }

    getOffset(index: number) {
        this.assertIndex(index);
        const prefix = getPrefixStatsBefore(this.root, index);
        const estimatedCountBefore = index - prefix.knownCount;
        return prefix.sizeTotal + estimatedCountBefore * this.estimatedSize;
    }

    getSize(index: number) {
        this.assertIndex(index);
        const node = findNode(this.root, index);
        return node ? node.size : this.estimatedSize;
    }

    getTotalSize() {
        const knownCount = getNodeKnownCount(this.root);
        const knownSize = getNodeSizeTotal(this.root);
        return knownSize + (this.length - knownCount) * this.estimatedSize;
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

    replaceKnownSizeEntries(entries: PrefixLayoutStoreSizeEntry[]) {
        for (const entry of entries) {
            this.assertIndex(entry.index);
            normalizeSize(entry.size);
        }

        const byIndex = new Map<number, { kind: SizeKind; size: number }>();
        for (const entry of entries) {
            const existing = byIndex.get(entry.index);
            if (entry.type === "measured") {
                byIndex.set(entry.index, { kind: SIZE_MEASURED, size: entry.size });
            } else if (existing?.kind !== SIZE_MEASURED) {
                byIndex.set(entry.index, { kind: SIZE_CACHED, size: entry.size });
            }
        }

        this.root = undefined;
        for (const [index, entry] of byIndex) {
            this.root = upsertNode(this.root, index, entry.size, entry.kind);
        }
    }

    resize(length: number) {
        const normalizedLength = normalizeLength(length);
        if (normalizedLength !== this.length) {
            this.lengthValue = normalizedLength;
            this.root = pruneFromIndex(this.root, normalizedLength);
        }
    }

    setMeasuredSize(index: number, size: number) {
        this.assertIndex(index);
        const normalizedSize = normalizeSize(size);
        const existing = findNode(this.root, index);
        const didChange = (existing?.size ?? this.estimatedSize) !== normalizedSize;
        if (!existing || existing.size !== normalizedSize || existing.kind !== SIZE_MEASURED) {
            this.root = upsertNode(this.root, index, normalizedSize, SIZE_MEASURED);
        }
        return didChange;
    }

    private assertIndex(index: number) {
        if (!this.hasIndex(index)) {
            throw new RangeError(`PrefixLayoutStore index ${index} is out of bounds for length ${this.length}`);
        }
    }
}

function findIndexAtOffsetInRange(
    node: KnownSizeNode | undefined,
    rangeStart: number,
    rangeEnd: number,
    prefixSize: number,
    offset: number,
    estimatedSize: number,
): number | undefined {
    let index: number | undefined;
    if (rangeStart < rangeEnd) {
        if (node) {
            const unknownCountBeforeNode = node.index - rangeStart - getNodeKnownCount(node.left);
            const sizeBeforeNode = getNodeSizeTotal(node.left) + unknownCountBeforeNode * estimatedSize;
            const nodeOffset = prefixSize + sizeBeforeNode;
            if (!isLessThanOrEqualOffset(nodeOffset, offset)) {
                index =
                    rangeStart < node.index
                        ? findIndexAtOffsetInRange(node.left, rangeStart, node.index, prefixSize, offset, estimatedSize)
                        : node.index;
            } else {
                const nodeEnd = nodeOffset + node.size;
                if (!isLessThanOrEqualOffset(nodeEnd, offset)) {
                    index = node.index;
                } else {
                    index = findIndexAtOffsetInRange(
                        node.right,
                        node.index + 1,
                        rangeEnd,
                        nodeEnd,
                        offset,
                        estimatedSize,
                    );
                }
            }
        } else {
            index = findEstimatedIndexAtOffset(rangeStart, rangeEnd, prefixSize, offset, estimatedSize);
        }
    }
    return index;
}

function findEstimatedIndexAtOffset(
    rangeStart: number,
    rangeEnd: number,
    prefixSize: number,
    offset: number,
    estimatedSize: number,
) {
    let index: number | undefined;
    if (estimatedSize === 0) {
        if (!isLessThanOrEqualOffset(prefixSize, offset)) {
            index = rangeStart;
        }
    } else {
        const estimatedIndex = rangeStart + Math.floor((offset - prefixSize) / estimatedSize);
        let candidate = Math.max(rangeStart, Math.min(rangeEnd - 1, estimatedIndex));
        while (
            candidate < rangeEnd &&
            isLessThanOrEqualOffset(prefixSize + (candidate - rangeStart + 1) * estimatedSize, offset)
        ) {
            candidate++;
        }
        while (
            candidate > rangeStart &&
            !isLessThanOrEqualOffset(prefixSize + (candidate - rangeStart) * estimatedSize, offset)
        ) {
            candidate--;
        }
        if (candidate < rangeEnd) {
            index = candidate;
        }
    }
    return index;
}

function createNode(index: number, size: number, kind: SizeKind): KnownSizeNode {
    return updateNode({
        index,
        kind,
        knownCount: 1,
        measuredCount: 0,
        measuredSizeTotal: 0,
        priority: getNodePriority(index),
        size,
        sizeTotal: 0,
    });
}

function findNode(root: KnownSizeNode | undefined, index: number) {
    let node = root;
    while (node && node.index !== index) {
        node = index < node.index ? node.left : node.right;
    }
    return node;
}

function getNodeKnownCount(node: KnownSizeNode | undefined) {
    return node?.knownCount ?? 0;
}

function getNodeMeasuredCount(node: KnownSizeNode | undefined) {
    return node?.measuredCount ?? 0;
}

function getNodeMeasuredSizeTotal(node: KnownSizeNode | undefined) {
    return node?.measuredSizeTotal ?? 0;
}

function getNodeSizeTotal(node: KnownSizeNode | undefined) {
    return node?.sizeTotal ?? 0;
}

function getPrefixStatsBefore(root: KnownSizeNode | undefined, index: number): PrefixStats {
    const stats: PrefixStats = {
        knownCount: 0,
        measuredCount: 0,
        measuredSizeTotal: 0,
        sizeTotal: 0,
    };
    let node = root;

    while (node) {
        if (index <= node.index) {
            node = node.left;
        } else {
            stats.knownCount += getNodeKnownCount(node.left) + 1;
            stats.sizeTotal += getNodeSizeTotal(node.left) + node.size;
            stats.measuredCount += getNodeMeasuredCount(node.left);
            stats.measuredSizeTotal += getNodeMeasuredSizeTotal(node.left);
            if (node.kind === SIZE_MEASURED) {
                stats.measuredCount++;
                stats.measuredSizeTotal += node.size;
            }
            node = node.right;
        }
    }

    return stats;
}

function getNodePriority(index: number) {
    let value = (index + 0x9e3779b9) >>> 0;
    value = Math.imul(value ^ (value >>> 16), 0x85ebca6b) >>> 0;
    value = Math.imul(value ^ (value >>> 13), 0xc2b2ae35) >>> 0;
    return (value ^ (value >>> 16)) >>> 0;
}

function pruneFromIndex(node: KnownSizeNode | undefined, length: number): KnownSizeNode | undefined {
    let nextNode: KnownSizeNode | undefined;
    if (node) {
        if (node.index >= length) {
            nextNode = pruneFromIndex(node.left, length);
        } else {
            node.right = pruneFromIndex(node.right, length);
            nextNode = updateNode(node);
        }
    }
    return nextNode;
}

function rotateLeft(node: KnownSizeNode) {
    const right = node.right!;
    node.right = right.left;
    right.left = updateNode(node);
    return updateNode(right);
}

function rotateRight(node: KnownSizeNode) {
    const left = node.left!;
    node.left = left.right;
    left.right = updateNode(node);
    return updateNode(left);
}

function updateNode(node: KnownSizeNode) {
    node.knownCount = getNodeKnownCount(node.left) + getNodeKnownCount(node.right) + 1;
    node.sizeTotal = getNodeSizeTotal(node.left) + getNodeSizeTotal(node.right) + node.size;
    node.measuredCount = getNodeMeasuredCount(node.left) + getNodeMeasuredCount(node.right);
    node.measuredSizeTotal = getNodeMeasuredSizeTotal(node.left) + getNodeMeasuredSizeTotal(node.right);
    if (node.kind === SIZE_MEASURED) {
        node.measuredCount++;
        node.measuredSizeTotal += node.size;
    }
    return node;
}

function upsertNode(root: KnownSizeNode | undefined, index: number, size: number, kind: SizeKind): KnownSizeNode {
    let node: KnownSizeNode;
    if (!root) {
        node = createNode(index, size, kind);
    } else if (index === root.index) {
        root.size = size;
        root.kind = kind;
        node = updateNode(root);
    } else if (index < root.index) {
        root.left = upsertNode(root.left, index, size, kind);
        node = root.left.priority < root.priority ? rotateRight(root) : updateNode(root);
    } else {
        root.right = upsertNode(root.right, index, size, kind);
        node = root.right.priority < root.priority ? rotateLeft(root) : updateNode(root);
    }
    return node;
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
