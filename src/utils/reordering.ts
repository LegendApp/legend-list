import { peek$, type StateContext } from "@/state/state";

export function sortContainerElements(ctx: StateContext) {
    let parent: HTMLDivElement | null = null;
    const indexByElement = new Map<HTMLElement, number>();
    for (const [containerId, viewRef] of ctx.viewRefs) {
        const element = viewRef.current as HTMLElement | null;
        const index = peek$(ctx, `containerItemIndex${containerId}`);
        if (element && index !== undefined) {
            parent ??= element.parentElement as HTMLDivElement | null;
            indexByElement.set(element, index);
        }
    }
    if (parent) {
        sortDOMElements(parent, indexByElement);
    }
}

export function sortDOMElements(container: HTMLDivElement, indexByElement: Map<HTMLElement, number>) {
    const elements = Array.from(container.children) as HTMLElement[];
    if (elements.length <= 1) return elements;

    // Create array of [element, itemIndex] tuples
    const items = elements.map((element) => [element, indexByElement.get(element) ?? null] as const);
    // Sort to get target positions
    items.sort((a, b) => {
        const aKey = a[1];
        const bKey = b[1];

        if (aKey === null) {
            return 1;
        }
        if (bKey === null) {
            return -1;
        }

        return aKey - bKey;
    });

    // Create mapping: element -> target position
    const targetPositions = new Map();
    items.forEach((item, index) => {
        targetPositions.set(item[0], index);
    });

    // Find Longest Increasing Subsequence of target positions
    // This represents elements already in correct relative order
    const currentPositions = elements.map((el) => targetPositions.get(el));
    const lis = findLIS(currentPositions);
    if (lis.length === elements.length) return;

    // Mark elements in LIS as stable (don't move them)
    const stableElements = new Set(lis.map((index) => elements[index]));
    // insertBefore can blur a focused row, so restore it after moving.
    const focusRoot = container.getRootNode() as Document | ShadowRoot;
    const focused = focusRoot.activeElement as HTMLElement | null;
    // Moving a focused row can scroll Chromium's editing caret, including inside a shadow host.
    // Keep that row stationary, preserving focus without firing blur/focus handlers.
    if (focused && focused !== container.ownerDocument.body) {
        const focusedIndex = elements.findIndex((element) => element.contains(focused));
        if (focusedIndex >= 0) {
            const focusedTarget = currentPositions[focusedIndex];
            for (const index of lis) {
                if (
                    (index < focusedIndex && currentPositions[index] > focusedTarget) ||
                    (index > focusedIndex && currentPositions[index] < focusedTarget)
                ) {
                    stableElements.delete(elements[index]);
                }
            }
            stableElements.add(elements[focusedIndex]);
        }
    }

    // Move only elements not in the stable sequence
    for (let targetPos = 0; targetPos < items.length; targetPos++) {
        const element = items[targetPos][0];
        if (!stableElements.has(element)) {
            // Find where to insert this element
            let nextStableElement = null;
            for (let i = targetPos + 1; i < items.length; i++) {
                const nextEl = items[i][0];
                if (stableElements.has(nextEl)) {
                    nextStableElement = nextEl;
                    break;
                }
            }

            // Preserve focus and animation state when reordering connected rows.
            if ("moveBefore" in container && typeof container.moveBefore === "function" && container.isConnected) {
                container.moveBefore(element, nextStableElement);
            } else if (nextStableElement) {
                container.insertBefore(element, nextStableElement);
            } else {
                container.appendChild(element);
            }
        }
    }

    if (focused && focused !== focusRoot.activeElement && focused.isConnected) {
        focused.focus({ preventScroll: true });
    }
}

// Helper: Find Longest Increasing Subsequence indices
function findLIS(arr: number[]) {
    const n = arr.length;
    const tails = [];
    const predecessors = new Array(n).fill(-1);
    const indices = [];

    for (let i = 0; i < n; i++) {
        const num = arr[i];

        // Binary search for position
        let left = 0,
            right = tails.length;
        while (left < right) {
            const mid = Math.floor((left + right) / 2);
            if (arr[indices[mid]] < num) {
                left = mid + 1;
            } else {
                right = mid;
            }
        }

        if (left === tails.length) {
            tails.push(num);
            indices.push(i);
        } else {
            tails[left] = num;
            indices[left] = i;
        }

        if (left > 0) {
            predecessors[i] = indices[left - 1];
        }
    }

    // Reconstruct LIS indices
    const result = [];
    let k = indices[indices.length - 1];
    while (k !== -1) {
        result.unshift(k);
        k = predecessors[k];
    }

    return result;
}
