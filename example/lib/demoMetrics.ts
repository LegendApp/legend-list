import { useEffect, useState, useSyncExternalStore } from "react";

export type DemoMetricValue = number | string;

export type DemoMetricDefinition = {
    id: string;
    label: string;
    initialValue: DemoMetricValue;
    resettable?: boolean;
};

export type DemoMetricSnapshot = ReadonlyArray<{
    id: string;
    label: string;
    value: DemoMetricValue;
}>;

export type DemoMetricStore = {
    destroy: () => void;
    getSnapshot: () => DemoMetricSnapshot;
    increment: (id: string, amount?: number) => void;
    reset: (currentValues?: Readonly<Record<string, DemoMetricValue>>) => void;
    set: (id: string, value: DemoMetricValue) => void;
    subscribe: (listener: () => void) => () => void;
    trackMount: (id: string) => () => void;
};

const DISPLAY_UPDATE_INTERVAL = 100;

export function createDemoMetricStore(definitions: DemoMetricDefinition[]): DemoMetricStore {
    const definitionById = new Map(definitions.map((definition) => [definition.id, definition]));
    const values = new Map(definitions.map((definition) => [definition.id, definition.initialValue]));
    const listeners = new Set<() => void>();
    const mountedTokens = new Map<string, Set<symbol>>();
    let destroyed = false;
    let flushTimer: ReturnType<typeof setTimeout> | undefined;
    let snapshot = createSnapshot();

    function createSnapshot(): DemoMetricSnapshot {
        return definitions.map((definition) => ({
            id: definition.id,
            label: definition.label,
            value: values.get(definition.id) ?? definition.initialValue,
        }));
    }

    function flush() {
        flushTimer = undefined;
        snapshot = createSnapshot();
        for (const listener of listeners) {
            listener();
        }
    }

    function scheduleFlush() {
        if (flushTimer === undefined) {
            flushTimer = setTimeout(flush, DISPLAY_UPDATE_INTERVAL);
        }
    }

    function set(id: string, value: DemoMetricValue) {
        if (!destroyed && definitionById.has(id) && values.get(id) !== value) {
            values.set(id, value);
            scheduleFlush();
        }
    }

    return {
        destroy: () => {
            destroyed = true;
            if (flushTimer !== undefined) {
                clearTimeout(flushTimer);
                flushTimer = undefined;
            }
            listeners.clear();
            mountedTokens.clear();
        },
        getSnapshot: () => snapshot,
        increment: (id, amount = 1) => {
            const currentValue = values.get(id);
            if (typeof currentValue === "number") {
                set(id, currentValue + amount);
            }
        },
        reset: (currentValues) => {
            if (!destroyed) {
                if (flushTimer !== undefined) {
                    clearTimeout(flushTimer);
                    flushTimer = undefined;
                }
                for (const definition of definitions) {
                    if (definition.resettable !== false && !mountedTokens.has(definition.id)) {
                        values.set(definition.id, definition.initialValue);
                    }
                }
                if (currentValues) {
                    for (const [id, value] of Object.entries(currentValues)) {
                        if (definitionById.has(id)) {
                            values.set(id, value);
                        }
                    }
                }
                flush();
            }
        },
        set,
        subscribe: (listener) => {
            if (!destroyed) {
                listeners.add(listener);
            }
            return () => listeners.delete(listener);
        },
        trackMount: (id) => {
            if (destroyed || !definitionById.has(id)) {
                return () => undefined;
            }
            const token = Symbol(id);
            let tokens = mountedTokens.get(id);
            if (!tokens) {
                tokens = new Set();
                mountedTokens.set(id, tokens);
            }
            tokens.add(token);
            set(id, tokens.size);

            return () => {
                if (tokens.delete(token)) {
                    set(id, tokens.size);
                }
            };
        },
    };
}

export function useDemoMetricStore(definitions: DemoMetricDefinition[]) {
    const [store] = useState(() => createDemoMetricStore(definitions));

    useEffect(() => () => store.destroy(), [store]);

    return store;
}

export function useDemoMetricSnapshot(store: DemoMetricStore) {
    return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}
