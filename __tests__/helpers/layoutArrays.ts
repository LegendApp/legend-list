import type { InternalState } from "../../src/types";

type LayoutField = "columnSpans" | "columns" | "positions";

function resolveLayoutIndex(state: InternalState, key: unknown): number | undefined {
    if (typeof key === "number" && Number.isInteger(key)) {
        return key;
    }

    if (typeof key !== "string") {
        return undefined;
    }

    const fromIndexByKey = state.indexByKey?.get(key);
    if (fromIndexByKey !== undefined) {
        return fromIndexByKey;
    }

    const fromIdCache = state.idCache?.indexOf(key);
    if (typeof fromIdCache === "number" && fromIdCache >= 0) {
        return fromIdCache;
    }

    const keyExtractor = state.props?.keyExtractor;
    const data = state.props?.data;
    if (keyExtractor && Array.isArray(data)) {
        for (let i = 0; i < data.length; i++) {
            if (keyExtractor(data[i], i) === key) {
                return i;
            }
        }
    }

    return undefined;
}

export function getLayoutValue(state: InternalState, field: LayoutField, key: unknown): number | undefined {
    const index = resolveLayoutIndex(state, key);
    if (index === undefined) {
        return undefined;
    }
    return state[field][index];
}

export function setLayoutValue(state: InternalState, field: LayoutField, key: unknown, value: number | undefined) {
    const index = resolveLayoutIndex(state, key);
    if (index === undefined) {
        return;
    }
    state[field][index] = value;
}

export function hasLayoutValue(state: InternalState, field: LayoutField, key: unknown): boolean {
    return getLayoutValue(state, field, key) !== undefined;
}

export function clearLayoutValues(state: InternalState, field: LayoutField) {
    state[field].length = 0;
}

export function countLayoutValues(values: Array<number | undefined>): number {
    let count = 0;
    for (let i = 0; i < values.length; i++) {
        if (values[i] !== undefined) {
            count++;
        }
    }
    return count;
}
