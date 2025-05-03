import * as React from "react";
import { useSyncExternalStore } from "react";
import type { View } from "react-native";
import type {
    AnchoredPosition,
    ColumnWrapperStyle,
    ViewAmountToken,
    ViewToken,
    ViewabilityAmountCallback,
    ViewabilityCallback,
} from "./types";

// This is an implementation of a simple state management system, inspired by Legend State.
// It stores values and listeners in Maps, with peek$ and set$ functions to get and set values.
// The set$ function also triggers the listeners.
//
// This is definitely not general purpose and has one big optimization/caveat: use$ is only ever called
// once for each unique name. So we don't need to manage a Set of listeners or dispose them,
// which saves needing useEffect hooks or managing listeners in a Set.

export type ListenerType =
    | "numContainers"
    | "numContainersPooled"
    | `containerItemKey${number}`
    | `containerItemData${number}`
    | `containerPosition${number}`
    | `containerColumn${number}`
    | "containersDidLayout"
    | "extraData"
    | "numColumns"
    | "lastItemKeys"
    | "totalSize"
    | "totalSizeWithScrollAdjust"
    | "paddingTop"
    | "alignItemsPaddingTop"
    | "stylePaddingTop"
    | "scrollAdjust"
    | "headerSize"
    | "footerSize"
    | "maintainVisibleContentPosition"
    | "debugRawScroll"
    | "debugComputedScroll";
// | "otherAxisSize";

type ListenerTypeValueMap = {
    numContainers: number;
    numContainersPooled: number;
    containersDidLayout: boolean;
    extraData: any;
    numColumns: number;
    lastItemKeys: string[];
    totalSize: number;
    totalSizeWithScrollAdjust: number;
    paddingTop: number;
    alignItemsPaddingTop: number;
    stylePaddingTop: number;
    scrollAdjust: number;
    headerSize: number;
    footerSize: number;
    maintainVisibleContentPosition: boolean;
    debugRawScroll: number;
    debugComputedScroll: number;
} & {
    [K in ListenerType as K extends `containerItemKey${number}` ? K : never]: string;
} & {
    [K in ListenerType as K extends `containerItemData${number}` ? K : never]: any;
} & {
    [K in ListenerType as K extends `containerPosition${number}` ? K : never]: AnchoredPosition;
} & {
    [K in ListenerType as K extends `containerColumn${number}` ? K : never]: number;
};

export interface StateContext {
    listeners: Map<ListenerType, Set<(value: any) => void>>;
    values: Map<ListenerType, any>;
    mapViewabilityCallbacks: Map<string, ViewabilityCallback>;
    mapViewabilityValues: Map<string, ViewToken>;
    mapViewabilityAmountCallbacks: Map<number, ViewabilityAmountCallback>;
    mapViewabilityAmountValues: Map<number, ViewAmountToken>;
    columnWrapperStyle: ColumnWrapperStyle | undefined;
    viewRefs: Map<number, React.RefObject<View>>;
}

const ContextState = React.createContext<StateContext | null>(null);

export function StateProvider({ children }: { children: React.ReactNode }) {
    const [value] = React.useState<StateContext>(() => ({
        listeners: new Map(),
        values: new Map<ListenerType, any>([
            ["paddingTop", 0],
            ["alignItemsPaddingTop", 0],
            ["stylePaddingTop", 0],
            ["headerSize", 0],
        ]),
        mapViewabilityCallbacks: new Map<string, ViewabilityCallback>(),
        mapViewabilityValues: new Map<string, ViewToken>(),
        mapViewabilityAmountCallbacks: new Map<number, ViewabilityAmountCallback>(),
        mapViewabilityAmountValues: new Map<number, ViewAmountToken>(),
        columnWrapperStyle: undefined,
        viewRefs: new Map<number, React.RefObject<View>>(),
    }));
    return <ContextState.Provider value={value}>{children}</ContextState.Provider>;
}

export function useStateContext() {
    return React.useContext(ContextState)!;
}

function createSelectorFunctionsArr(ctx: StateContext, signalNames: ListenerType[]) {
    let lastValues: any[] = [];
    let lastSignalValues: any[] = [];

    return {
        subscribe: (cb: (value: any) => void) => {
            const listeners: (() => void)[] = [];
            for (const signalName of signalNames) {
                listeners.push(listen$(ctx, signalName, cb));
            }
            return () => {
                for (const listener of listeners) {
                    listener();
                }
            };
        },
        get: () => {
            const currentValues: any[] = [];
            let hasChanged = false;

            for (let i = 0; i < signalNames.length; i++) {
                const value = peek$(ctx, signalNames[i]);
                currentValues.push(value);

                // Check if this value has changed from last time
                if (value !== lastSignalValues[i]) {
                    hasChanged = true;
                }
            }

            // Update our cached signal values regardless
            lastSignalValues = currentValues;

            // Only create a new array reference if something changed
            if (hasChanged) {
                lastValues = currentValues;
            }

            return lastValues;
        },
    };
}

export function useArr$<T extends ListenerType>(signalNames: T[]): ListenerTypeValueMap[T][] {
    const ctx = React.useContext(ContextState)!;
    const { subscribe, get } = React.useMemo(() => createSelectorFunctionsArr(ctx, signalNames), [ctx, signalNames]);
    const value = useSyncExternalStore(subscribe, get);

    return value;
}

export function listen$<T extends ListenerType>(
    ctx: StateContext,
    signalName: T,
    cb: (value: ListenerTypeValueMap[T]) => void,
): () => void {
    const { listeners } = ctx;
    let setListeners = listeners.get(signalName);
    if (!setListeners) {
        setListeners = new Set();
        listeners.set(signalName, setListeners);
    }
    setListeners!.add(cb);

    return () => setListeners!.delete(cb);
}

// Function to get value based on ListenerType without requiring generic type
export function peek$<T extends ListenerType>(ctx: StateContext, signalName: T): ListenerTypeValueMap[T] {
    const { values } = ctx;
    return values.get(signalName);
}

export function set$<T extends ListenerType>(ctx: StateContext, signalName: T, value: ListenerTypeValueMap[T]) {
    const { listeners, values } = ctx;
    if (values.get(signalName) !== value) {
        values.set(signalName, value);
        const setListeners = listeners.get(signalName);
        if (setListeners) {
            for (const listener of setListeners) {
                listener(value);
            }
        }
    }
}

export function getContentSize(ctx: StateContext) {
    const { values } = ctx;
    const stylePaddingTop = values.get("stylePaddingTop") || 0;
    const headerSize = values.get("headerSize") || 0;
    const footerSize = values.get("footerSize") || 0;
    const totalSize = values.get("totalSize") || 0;
    return headerSize + footerSize + totalSize + stylePaddingTop;
}
