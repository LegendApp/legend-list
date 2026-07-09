import { describe, expect, it } from "bun:test";

import "../setup";

import { sortDOMElements } from "../../src/utils/reordering";

interface MockElement extends HTMLElement {
    id: string;
}

function createElement(id: string, index: number): MockElement {
    return {
        getAttribute: (name: string) => (name === "data-index" ? String(index) : null),
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
    it("reorders children using data-index", () => {
        const first = createElement("first", 2);
        const second = createElement("second", 0);
        const third = createElement("third", 1);
        const elements = [first, second, third];
        const container = createContainer(elements);

        sortDOMElements(container);

        expect(elements.map((element) => element.id)).toEqual(["second", "third", "first"]);
    });
});
