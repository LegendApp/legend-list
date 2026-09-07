import assert from "node:assert/strict";
import { RowLayoutStore } from "../../src/core/RowLayoutStore";

const count = 200_000;
const store = new RowLayoutStore({ estimatedSize: 20, length: 3, numColumns: 3, spans: [2, 2, 1] });
store.setMeasuredSize(0, 30);
store.setMeasuredSize(1, 40);
store.setMeasuredSize(2, 50);
store.splice(1, 0, count);
assert.equal(store.length, count + 3);
assert.equal(store.getSpan(0), 2);
assert.equal(store.getSpan(1), 1);
assert.equal(store.getSpan(count + 1), 2);
assert.equal(store.getSize(count + 1), 40);

// Move both directions using post-removal destinations; retained spans and measurements follow the items.
store.move(0, 3, count);
assert.equal(store.getSpan(1), 2);
assert.equal(store.getSize(1), 40);
assert.equal(store.getSize(2), 50);
assert.equal(store.getSpan(3), 2);
assert.equal(store.getSize(3), 30);
store.move(3, 0, count);
assert.equal(store.getSpan(0), 2);
assert.equal(store.getSize(0), 30);
assert.equal(store.getSize(count + 1), 40);

store.splice(1, count, 0);
assert.equal(store.length, 3);
assert.deepEqual(
    [0, 1, 2].map((index) => store.getSpan(index)),
    [2, 2, 1],
);
assert.deepEqual(
    [0, 1, 2].map((index) => store.getSize(index)),
    [30, 40, 50],
);
assert.deepEqual(
    [0, 1, 2].map((index) => store.getOffset(index)),
    [0, 30, 30],
);
assert.equal(store.getTotalSize(), 80);
