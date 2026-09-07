// Avoid argument spreads: large span ranges can exceed JavaScript engine call limits.
export function moveSpans(spans: Array<number | undefined>, from: number, to: number, count: number) {
    const moved = spans.slice(from, from + count);
    if (to < from) {
        spans.copyWithin(to + count, to, from);
    } else {
        spans.copyWithin(from, from + count, to + count);
    }
    for (let index = 0; index < count; index++) {
        spans[to + index] = moved[index];
    }
}

export function spliceSpans(
    spans: Array<number | undefined>,
    index: number,
    deleteCount: number,
    insertCount: number,
    insertedSpan: number | undefined,
) {
    const previousLength = spans.length;
    const nextLength = previousLength - deleteCount + insertCount;
    if (insertCount > deleteCount) {
        spans.length = nextLength;
        spans.copyWithin(index + insertCount, index + deleteCount, previousLength);
    } else if (insertCount < deleteCount) {
        spans.copyWithin(index + insertCount, index + deleteCount, previousLength);
        spans.length = nextLength;
    }
    spans.fill(insertedSpan, index, index + insertCount);
}
