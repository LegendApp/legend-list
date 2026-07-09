import { getDataKey, getDataLength } from "@/core/IndexedData";
import type { InternalState } from "@/types.internal";

/**
 * Generates and caches a unique ID for a list item at the given index.
 *
 * @param state - The internal state containing data, keyExtractor, and ID cache
 * @param index - The index of the item to get the ID for
 * @returns The unique ID for the item, or empty string if data is not available
 */
export function getId(state: InternalState, index: number): string {
    if (!state.props.dataSource && !state.props.data) {
        return "";
    }

    const id = (index < getDataLength(state) ? getDataKey(state, index) : null) as string;
    state.idCache[index] = id;
    return id;
}
