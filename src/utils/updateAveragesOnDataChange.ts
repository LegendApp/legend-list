import type { InternalState } from "@/types";

/**
 * Preserves average sizes for items that are considered equal between data changes.
 *
 * This function prevents maintainVisibleContentPosition (MVCP) scroll jumps by only
 * preserving size averages for items that are semantically the same between data updates.
 *
 * When data changes, we compare each new item with its corresponding old item (by ID).
 * If itemsAreEqual returns true, we preserve that item's known size in the averages.
 * This ensures MVCP calculations use accurate historical sizes for unchanged content.
 *
 * @param state - Internal Legend List state
 * @param oldData - Previous data array
 * @param newData - New data array
 */
export function updateAveragesOnDataChange<ItemT>(
    state: InternalState,
    oldData: readonly ItemT[],
    newData: readonly ItemT[],
) {
    const {
        averageSizes,
        sizesKnown,
        indexByKey,
        props: { itemsAreEqual, getItemType, keyExtractor },
    } = state;

    if (!itemsAreEqual || !oldData.length || !newData.length) {
        // Reset all averages when no equality comparison is possible
        for (const key in averageSizes) {
            delete averageSizes[key];
        }
        return;
    }

    // Track preserved sizes grouped by item type
    const itemTypesToPreserve: Record<string, { totalSize: number; count: number }> = {};

    const newDataLength = newData.length;
    const oldDataLength = oldData.length;

    // Process each new item to see if it matches an old item
    for (let newIndex = 0; newIndex < newDataLength; newIndex++) {
        const newItem = newData[newIndex];
        const id = keyExtractor ? keyExtractor(newItem, newIndex) : String(newIndex);

        // Look up the old index for this item ID
        const oldIndex = indexByKey.get(id);
        if (oldIndex !== undefined && oldIndex < oldDataLength) {
            const knownSize = sizesKnown.get(id);

            // Skip items we don't have size measurements for
            if (knownSize === undefined) continue;

            const oldItem = oldData[oldIndex];

            // Use the user-provided equality function to determine if items are the same
            const areEqual = itemsAreEqual(oldItem, newItem, newIndex, newData);

            if (areEqual) {
                // Preserve this item's size in the averages calculation
                const itemType = getItemType ? (getItemType(newItem, newIndex) ?? "") : "";

                let typeData = itemTypesToPreserve[itemType];
                if (!typeData) {
                    typeData = itemTypesToPreserve[itemType] = { count: 0, totalSize: 0 };
                }

                typeData.totalSize += knownSize;
                typeData.count++;
            }
        }
    }

    // Clear existing averages
    for (const key in averageSizes) {
        delete averageSizes[key];
    }

    // Rebuild averages using only preserved items
    for (const itemType in itemTypesToPreserve) {
        const { totalSize, count } = itemTypesToPreserve[itemType];
        if (count > 0) {
            averageSizes[itemType] = {
                avg: totalSize / count,
                num: count,
            };
        }
    }
}
