import { expect, it } from "bun:test";
import { moveSpans, spliceSpans } from "../../src/core/rowSpanMutations";

it("preserves cached and unknown spans across all small splice shapes", () => {
    const initial = [1, undefined, 3, 2, undefined];
    for (let index = 0; index <= initial.length; index++) {
        for (let deleted = 0; deleted <= initial.length - index; deleted++) {
            for (let inserted = 0; inserted <= 6; inserted++) {
                for (const span of [undefined, 2]) {
                    const actual = [...initial];
                    spliceSpans(actual, index, deleted, inserted, span);
                    expect(actual).toEqual([
                        ...initial.slice(0, index),
                        ...Array(inserted).fill(span),
                        ...initial.slice(index + deleted),
                    ]);
                }
            }
        }
    }
});

it("preserves order when moving span ranges in either direction", () => {
    const initial = [1, undefined, 3, 2, undefined];
    for (let from = 0; from <= initial.length; from++) {
        for (let count = 0; count <= initial.length - from; count++) {
            for (let to = 0; to <= initial.length - count; to++) {
                const actual = [...initial];
                const remaining = initial.filter((_, index) => index < from || index >= from + count);
                moveSpans(actual, from, to, count);
                expect(actual).toEqual([
                    ...remaining.slice(0, to),
                    ...initial.slice(from, from + count),
                    ...remaining.slice(to),
                ]);
            }
        }
    }
});

it("handles large inserted and moved ranges without argument-count limits", () => {
    const spans: Array<number | undefined> = [1, 2];
    spliceSpans(spans, 1, 0, 200_000, undefined);
    expect(spans.length).toBe(200_002);
    expect(spans[0]).toBe(1);
    expect(spans.at(-1)).toBe(2);
    moveSpans(spans, 1, 0, 200_000);
    expect(spans.slice(-2)).toEqual([1, 2]);
    expect(spans.slice(0, -2).every((span) => span === undefined)).toBe(true);
    spliceSpans(spans, 0, 200_000, 0, undefined);
    expect(spans).toEqual([1, 2]);
});
