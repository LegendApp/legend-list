import * as React from "react";
import type { ViewAmountToken, ViewToken, ViewabilityAmountCallback, ViewabilityCallback } from "./types";

// This is an implementation of a simple state management system, inspired by Legend State.
// It stores values and listeners in Maps, with peek$ and set$ functions to get and set values.
// The set$ function also triggers the listeners.
//
// This is definitely not general purpose and has one big optimization/caveat: use$ is only ever called
// once for each unique name. So we don't need to manage a Set of listeners or dispose them,
// which saves needing useEffect hooks or managing listeners in a Set.

export type ListenerType =
    | "numContainers"
    | `containerItemKey${number}`
    | `containerPosition${number}`
    | `numItems`
    | `lastItemKey`
    | "totalSize"
    | "paddingTop"
    | "stylePaddingTop"
    | "headerSize"
    | "footerSize";

export interface StateContext {
    hooks: Map<ListenerType, () => void>;
    listeners: Map<ListenerType, Set<(value: any) => void>>;
    values: Map<ListenerType, any>;
    mapViewabilityCallbacks: Map<string, ViewabilityCallback>;
    mapViewabilityValues: Map<string, ViewToken>;
    mapViewabilityAmountCallbacks: Map<number, ViewabilityAmountCallback>;
    mapViewabilityAmountValues: Map<number, ViewAmountToken>;
}

const ContextState = React.createContext<StateContext | null>(null);

export function StateProvider({ children }: { children: React.ReactNode }) {
    const [value] = React.useState(() => ({
        hooks: new Map(),
        listeners: new Map(),
        values: new Map(),
        mapViewabilityCallbacks: new Map<string, ViewabilityCallback>(),
        mapViewabilityValues: new Map<string, ViewToken>(),
        mapViewabilityAmountCallbacks: new Map<number, ViewabilityAmountCallback>(),
        mapViewabilityAmountValues: new Map<number, ViewAmountToken>(),
    }));
    return <ContextState.Provider value={value}>{children}</ContextState.Provider>;
}

export function useStateContext() {
    return React.useContext(ContextState)!;
}

export function use$<T>(signalName: ListenerType): T {
    const { hooks, values } = React.useContext(ContextState)!;
    const [, forceUpdate] = React.useReducer((x) => x + 1, 0);
    hooks.set(signalName, forceUpdate);

    return values.get(signalName);
}

export function listen$<T>(ctx: StateContext, signalName: ListenerType, cb: (value: T) => void): () => void {
    const { listeners } = ctx;
    let setListeners = listeners.get(signalName);
    if (!setListeners) {
        setListeners = new Set();
        listeners.set(signalName, setListeners);
    }
    setListeners!.add(cb);

    return () => setListeners!.delete(cb);
}

export function peek$<T>(ctx: StateContext, signalName: ListenerType): T {
    const { values } = ctx;
    return values.get(signalName);
}

export function set$(ctx: StateContext, signalName: ListenerType, value: any) {
    const { listeners, hooks, values } = ctx;
    if (values.get(signalName) !== value) {
        values.set(signalName, value);
        hooks.get(signalName)?.();
        const setListeners = listeners.get(signalName);
        if (setListeners) {
            for (const listener of setListeners) {
                listener(value);
            }
        }
    }
}
