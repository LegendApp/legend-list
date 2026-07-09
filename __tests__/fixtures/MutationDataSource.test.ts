import { describe, expect, it, mock } from "bun:test";
import { MutationDataSource } from "../../example/screens/fixtures/MutationDataSource";

type Item = { id: string; value: string };

function createSource(length = 5) {
    return new MutationDataSource<Item>({
        generatedItemFactory: (index) => ({ id: `base-${index}`, value: `Base ${index}` }),
        generatedKeyPrefix: "base-",
        length,
    });
}

describe("MutationDataSource fixture", () => {
    it("preserves stable generated keys through splice and post-removal moves", () => {
        const source = createSource();
        const listener = mock(() => {});
        source.subscribe(listener);

        source.splice(2, 1, [{ item: { id: "inserted", value: "Inserted" }, key: "inserted" }]);
        source.move(1, 3, 2);

        expect(Array.from({ length: source.getLength() }, (_, index) => source.getKey(index))).toEqual([
            "base-0",
            "base-3",
            "base-4",
            "base-1",
            "inserted",
        ]);
        expect(source.getItem(4)).toEqual({ id: "inserted", value: "Inserted" });
        expect(source.getRevision()).toBe(2);
        expect(listener).toHaveBeenNthCalledWith(1, {
            length: 5,
            operations: [{ deleteCount: 1, index: 2, insertCount: 1, type: "splice" }],
            previousLength: 5,
            previousRevision: 0,
            revision: 1,
        });
        expect(listener).toHaveBeenNthCalledWith(2, {
            length: 5,
            operations: [{ count: 2, from: 1, to: 3, type: "move" }],
            previousLength: 5,
            previousRevision: 1,
            revision: 2,
        });
    });

    it("emits explicit preserve and invalidate updates", () => {
        const source = createSource();
        const listener = mock(() => {});
        source.subscribe(listener);

        source.update(2, { id: "base-2", value: "Edited" }, "preserve");
        source.update(2, { id: "base-2", value: "Expanded" }, "invalidate");

        expect(source.getItem(2)).toEqual({ id: "base-2", value: "Expanded" });
        expect(listener.mock.calls.map(([batch]) => batch.operations[0])).toEqual([
            { count: 1, index: 2, layout: "preserve", type: "update" },
            { count: 1, index: 2, layout: "invalidate", type: "update" },
        ]);
    });

    it("reports each adjacent insertion independently after piece compaction", () => {
        const source = createSource();
        const listener = mock(() => {});
        source.subscribe(listener);

        source.splice(0, 0, [{ item: { id: "first", value: "First" }, key: "first" }]);
        source.splice(0, 0, [{ item: { id: "second", value: "Second" }, key: "second" }]);

        expect(source.getLength()).toBe(7);
        expect(listener.mock.calls.map(([batch]) => batch.operations[0])).toEqual([
            { deleteCount: 0, index: 0, insertCount: 1, type: "splice" },
            { deleteCount: 0, index: 0, insertCount: 1, type: "splice" },
        ]);
    });

    it("keeps a million logical rows virtual until an item is requested", () => {
        const factory = mock((index: number) => ({ id: `line-${index}`, value: `Line ${index}` }));
        const source = new MutationDataSource<Item>({
            generatedItemFactory: factory,
            generatedKeyPrefix: "line-",
            length: 1_000_000,
        });

        expect(source.getLength()).toBe(1_000_000);
        expect(source.getKey(999_999)).toBe("line-999999");
        expect(factory).not.toHaveBeenCalled();
        expect(source.getItem(999_999)).toEqual({ id: "line-999999", value: "Line 999999" });
        expect(factory).toHaveBeenCalledTimes(1);
    });
});
