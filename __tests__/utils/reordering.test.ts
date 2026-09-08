import { describe, expect, it, mock, spyOn } from "bun:test";

import "../setup";

import { sortDOMElements } from "../../src/utils/reordering";

interface MockElement extends HTMLElement {
    id: string;
}

function createElement(id: string): MockElement {
    return {
        id,
    } as unknown as MockElement;
}

function createContainer(elements: MockElement[]): HTMLDivElement {
    return {
        appendChild: (element: MockElement) => {
            const currentIndex = elements.indexOf(element);
            if (currentIndex >= 0) {
                elements.splice(currentIndex, 1);
            }
            elements.push(element);
            return element;
        },
        children: elements,
        insertBefore: (element: MockElement, before: MockElement | null) => {
            const currentIndex = elements.indexOf(element);
            if (currentIndex >= 0) {
                elements.splice(currentIndex, 1);
            }

            if (!before) {
                elements.push(element);
                return element;
            }

            const beforeIndex = elements.indexOf(before);
            if (beforeIndex >= 0) {
                elements.splice(beforeIndex, 0, element);
            } else {
                elements.push(element);
            }

            return element;
        },
    } as unknown as HTMLDivElement;
}

describe("sortDOMElements", () => {
    it("reorders children using a provided index map", () => {
        const first = createElement("first");
        const second = createElement("second");
        const third = createElement("third");
        const elements = [first, second, third];
        const container = createContainer(elements);
        const indexByElement = new Map<HTMLElement, number>([
            [first, 2],
            [second, 0],
            [third, 1],
        ]);

        sortDOMElements(container, indexByElement);

        expect(elements.map((element) => element.id)).toEqual(["second", "third", "first"]);
    });

    for (const mode of ["atomic", "fallback", "detached"] as const) {
        it(`preserves sorted order for every five-row permutation using ${mode} moves`, () => {
            const rows = [0, 1, 2, 3, 4].map((id) => createElement(String(id)));
            const indexByElement = new Map(rows.map((row, index) => [row, index]));
            for (const order of permutations(rows)) {
                const elements = [...order];
                const container = createContainer(elements);
                Object.defineProperty(container, "isConnected", { value: mode !== "detached" });
                const atomicMove = mock(container.insertBefore);
                if (mode !== "fallback") Object.assign(container, { moveBefore: atomicMove });
                const insert = spyOn(container, "insertBefore");
                const append = spyOn(container, "appendChild");

                sortDOMElements(container, indexByElement);

                expect(elements).toEqual(rows);
                if (mode === "atomic") {
                    expect(insert).not.toHaveBeenCalled();
                    expect(append).not.toHaveBeenCalled();
                } else {
                    expect(atomicMove).not.toHaveBeenCalled();
                }

                atomicMove.mockClear();
                insert.mockClear();
                append.mockClear();
                sortDOMElements(container, indexByElement);
                expect(atomicMove).not.toHaveBeenCalled();
                expect(insert).not.toHaveBeenCalled();
                expect(append).not.toHaveBeenCalled();
            }
        });
    }
});

function permutations<T>(items: T[]): T[][] {
    if (items.length <= 1) return [items];
    return items.flatMap((item, index) =>
        permutations(items.filter((_, otherIndex) => index !== otherIndex)).map((rest) => [item, ...rest]),
    );
}
