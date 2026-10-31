import { describe, expect, it, mock, spyOn } from "bun:test";

import "../setup";

import { sortDOMElements } from "../../src/utils/reordering";

interface MockElement extends HTMLElement {
    id: string;
}

function createElement(id: string): MockElement {
    return {
        contains: () => false,
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
        getRootNode(this: HTMLDivElement) {
            return this.ownerDocument ?? { activeElement: null };
        },
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

    for (const mode of ["atomic", "fallback", "detached", "editable", "shadow"] as const) {
        it(`preserves sorted order for every five-row permutation using ${mode} moves`, () => {
            const rows = [0, 1, 2, 3, 4].map((id) => createElement(String(id)));
            const indexByElement = new Map(rows.map((row, index) => [row, index]));
            for (const order of permutations(rows)) {
                const elements = [...order];
                const container = createContainer(elements);
                Object.defineProperty(container, "isConnected", { value: mode !== "detached" });
                const rawInsert = container.insertBefore;
                const atomicMove = mock(rawInsert);
                if (mode === "editable" || mode === "shadow") {
                    const editable = { isContentEditable: mode === "editable" };
                    Object.assign(container, { ownerDocument: { activeElement: editable } });
                    for (const row of rows)
                        Object.assign(row, { contains: (node: unknown) => node === editable && row === rows[2] });
                    atomicMove.mockImplementation((element, before) => {
                        expect(element).not.toBe(rows[2]);
                        return rawInsert(element, before);
                    });
                }
                if (mode !== "fallback") Object.assign(container, { moveBefore: atomicMove });
                const insert = spyOn(container, "insertBefore");
                const append = spyOn(container, "appendChild");

                sortDOMElements(container, indexByElement);

                expect(elements).toEqual(rows);
                if (mode === "atomic" || mode === "editable" || mode === "shadow") {
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

    for (const mode of ["editable", "shadow host", "shadow root"] as const) {
        it(`keeps a focused ${mode} row from scrolling its owner during an atomic move`, () => {
            const first = createElement("first");
            const second = createElement("second");
            const elements = [first, second];
            const container = createContainer(elements);
            const scroller = { scrollTop: 160 };
            const editable = { focus: mock(() => {}), isConnected: true, isContentEditable: mode !== "shadow host" };
            const outerHost = {};
            const ownerDocument = { activeElement: mode === "shadow root" ? outerHost : editable };
            const focusRoot = mode === "shadow root" ? { activeElement: editable } : ownerDocument;
            Object.assign(container, { getRootNode: () => focusRoot });
            editable.focus.mockImplementation(() => {
                focusRoot.activeElement = editable;
            });
            Object.assign(first, { contains: (node: unknown) => node === editable });
            Object.assign(second, { contains: () => false });
            const insert = container.insertBefore;
            const append = container.appendChild;
            Object.assign(container, {
                appendChild: (element: Node) => {
                    ownerDocument.activeElement = null;
                    return append(element);
                },
                insertBefore: (element: Node, before: Node | null) => {
                    ownerDocument.activeElement = null;
                    return insert(element, before);
                },
                isConnected: true,
                moveBefore: (element: Node, before: Node | null) => {
                    insert(element, before);
                    // Chromium can scroll the editing caret when a focused recycled row moves atomically.
                    if ((element as HTMLElement).contains?.(editable as unknown as Node)) scroller.scrollTop = 1057;
                },
                ownerDocument,
            });

            sortDOMElements(
                container,
                new Map([
                    [first, 1],
                    [second, 0],
                ]),
            );

            expect(elements).toEqual([second, first]);
            expect(scroller.scrollTop).toBe(160);
            expect(focusRoot.activeElement).toBe(editable);
            expect(ownerDocument.activeElement).toBe(mode === "shadow root" ? outerHost : editable);
            expect(editable.focus).not.toHaveBeenCalled();
        });
    }

    it("restores focus blurred by insertBefore when moveBefore is unavailable", () => {
        const first = createElement("first");
        const second = createElement("second");
        const elements = [first, second];
        const container = createContainer(elements);
        const body = {};
        const input = { focus: mock(() => {}), isConnected: true };
        input.focus.mockImplementation(() => {
            ownerDocument.activeElement = input;
        });
        const ownerDocument: { activeElement: unknown; body: unknown } = { activeElement: input, body };
        const { appendChild, insertBefore } = container;
        // Moving a row blurs focus inside it, as insertBefore/appendChild do in browsers without moveBefore.
        Object.assign(container, {
            appendChild: (element: MockElement) => {
                ownerDocument.activeElement = body;
                return appendChild(element);
            },
            insertBefore: (element: MockElement, before: MockElement | null) => {
                ownerDocument.activeElement = body;
                return insertBefore(element, before);
            },
            ownerDocument,
        });

        sortDOMElements(
            container,
            new Map<HTMLElement, number>([
                [first, 1],
                [second, 0],
            ]),
        );

        expect(elements.map((element) => element.id)).toEqual(["second", "first"]);
        expect(input.focus).toHaveBeenCalledWith({ preventScroll: true });
        expect(ownerDocument.activeElement).toBe(input);
    });
});

function permutations<T>(items: T[]): T[][] {
    if (items.length <= 1) return [items];
    return items.flatMap((item, index) =>
        permutations(items.filter((_, otherIndex) => index !== otherIndex)).map((rest) => [item, ...rest]),
    );
}
