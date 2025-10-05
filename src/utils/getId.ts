import type { InternalState } from "@/types";

/**
 * Generates and caches a unique ID for a list item at the given index.
 *
 * @param state - The internal state containing data, keyExtractor, and ID cache
 * @param index - The index of the item to get the ID for
 * @returns The unique ID for the item, or empty string if data is not available
 */
export function getId(state: InternalState, index: number): string {
    const { data, keyExtractor } = state.props;
    if (!data) {
        return "";
    }

    // Generate and cache the ID
    const ret = index < data.length ? (keyExtractor ? keyExtractor(data[index], index) : index) : null;
    const id = ret as string;
    state.idCache[index] = id;
    return id;
}
