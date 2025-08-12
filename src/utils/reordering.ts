const mapFn = (element: HTMLElement): [HTMLElement, number | null] => {
    const indexStr = element.getAttribute("index")!;
    return [element, indexStr === null ? null : parseInt(indexStr)];
};

// export function sortDOMElementsOptimal(container: HTMLDivElement) {
//     const elements = Array.from(container.children) as HTMLElement[];
//     if (elements.length <= 1) return elements;

//     // Create array of [element, key, currentIndex] tuples
//     const items = elements.map(mapFn);
//     // Sort to get target positions
//     items.sort((a, b) => {
//         const aKey = a[1];
//         const bKey = b[1];

//         if (aKey === null) {
//             return 1;
//         }
//         if (bKey === null) {
//             return -1;
//         }

//         return aKey - bKey;
//     });

//     // Find longest subsequence that's already in correct order
//     const targetOrder = items.map((item) => item[0]);
//     const stableElements = new Set();

//     // Find elements that are already in correct relative positions
//     let lastCorrectIndex = -1;
//     for (let i = 0; i < targetOrder.length; i++) {
//         const currentElementIndex = elements.indexOf(targetOrder[i]);

//         if (currentElementIndex > lastCorrectIndex) {
//             stableElements.add(targetOrder[i]);
//             lastCorrectIndex = currentElementIndex;
//         }
//     }

//     // Only move elements that are NOT in the stable subsequence
//     const elementsToMove = targetOrder.filter((el) => !stableElements.has(el));

//     // Move each misplaced element to its correct position
//     for (const elementToMove of elementsToMove) {
//         const targetIndex = targetOrder.indexOf(elementToMove);

//         // Find the correct insertion point
//         let insertBeforeElement = null;
//         for (let i = targetIndex + 1; i < targetOrder.length; i++) {
//             if (container.contains(targetOrder[i])) {
//                 insertBeforeElement = targetOrder[i];
//                 break;
//             }
//         }

//         if (insertBeforeElement) {
//             container.insertBefore(elementToMove, insertBeforeElement);
//             console.log("inserted before", elementToMove, insertBeforeElement);
//         } else {
//             container.appendChild(elementToMove);
//             console.log("appended", elementToMove);
//         }
//     }

//     return targetOrder;
// }

// Even more efficient: use patience sorting approach
export function sortDOMElementsPatience(container: HTMLDivElement) {
    const elements = Array.from(container.children) as HTMLElement[];
    if (elements.length <= 1) return elements;

    // Create array of [element, key, currentIndex] tuples
    const items = elements.map(mapFn);
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

    // Mark elements in LIS as stable (don't move them)
    const stableIndices = new Set(lis);

    // Move only elements not in the stable sequence
    for (let targetPos = 0; targetPos < items.length; targetPos++) {
        const element = items[targetPos][0];
        const currentPos = elements.indexOf(element);

        if (!stableIndices.has(currentPos)) {
            // Find where to insert this element
            let nextStableElement = null;
            for (let i = targetPos + 1; i < items.length; i++) {
                const nextEl = items[i][0];
                const nextCurrentPos = elements.indexOf(nextEl);
                if (stableIndices.has(nextCurrentPos)) {
                    nextStableElement = nextEl;
                    break;
                }
            }

            if (nextStableElement) {
                container.insertBefore(element, nextStableElement);
            } else {
                container.appendChild(element);
            }
        }
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
