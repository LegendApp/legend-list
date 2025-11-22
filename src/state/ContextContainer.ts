import {
    createContext,
    type Dispatch,
    type SetStateAction,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
} from "react";

import { IsNewArchitecture } from "@/constants";
import { useInit } from "@/hooks/useInit";
import { useArr$, useSelector$, useStateContext } from "@/state/state";
import type { LegendListRecyclingState, ViewabilityAmountCallback, ViewabilityCallback } from "@/types";
import { isFunction } from "@/utils/helpers";

export interface ContextContainerType {
    containerId: number;
    itemKey: string;
    index: number;
    value: any;
    triggerLayout: () => void;
}

export const ContextContainer = createContext<ContextContainerType>(null as any);

export function useViewability<ItemT = any>(callback: ViewabilityCallback<ItemT>, configId?: string) {
    const ctx = useStateContext();
    const { containerId } = useContext(ContextContainer);

    const key = containerId + (configId ?? "");

    useInit(() => {
        const value = ctx.mapViewabilityValues.get(key);
        if (value) {
            callback(value);
        }
    });

    ctx.mapViewabilityCallbacks.set(key, callback);

    useEffect(
        () => () => {
            ctx.mapViewabilityCallbacks.delete(key);
        },
        [],
    );
}

export function useViewabilityAmount<ItemT = any>(callback: ViewabilityAmountCallback<ItemT>) {
    const ctx = useStateContext();
    const { containerId } = useContext(ContextContainer);

    useInit(() => {
        const value = ctx.mapViewabilityAmountValues.get(containerId);
        if (value) {
            callback(value);
        }
    });

    ctx.mapViewabilityAmountCallbacks.set(containerId, callback);

    useEffect(
        () => () => {
            ctx.mapViewabilityAmountCallbacks.delete(containerId);
        },
        [],
    );
}

export function useRecyclingEffect(effect: (info: LegendListRecyclingState<unknown>) => void | (() => void)) {
    const { index, value } = useContext(ContextContainer);
    const prevValues = useRef<{ prevIndex: number | undefined; prevItem: any }>({
        prevIndex: undefined,
        prevItem: undefined,
    });

    useEffect(() => {
        let ret: void | (() => void);
        // Only run effect if there's a previous value
        if (prevValues.current.prevIndex !== undefined && prevValues.current.prevItem !== undefined) {
            ret = effect({
                index,
                item: value,
                prevIndex: prevValues.current.prevIndex,
                prevItem: prevValues.current.prevItem,
            });
        }

        // Update refs for next render
        prevValues.current = {
            prevIndex: index,
            prevItem: value,
        };

        return ret!;
    }, [index, value, effect]);
}

export function useRecyclingState<ItemT>(valueOrFun: ((info: LegendListRecyclingState<ItemT>) => ItemT) | ItemT) {
    const { index, value, itemKey, triggerLayout } = useContext(ContextContainer);
    const refState = useRef<{ itemKey: string | null; value: ItemT | null }>({
        itemKey: null,
        value: null,
    });
    const [_, setRenderNum] = useState(0);
    const state = refState.current;

    if (state.itemKey !== itemKey) {
        state.itemKey = itemKey;
        // Reset local state in ref
        state.value = isFunction(valueOrFun)
            ? valueOrFun({
                  index,
                  item: value,
                  prevIndex: undefined,
                  prevItem: undefined,
              })
            : valueOrFun;
    }

    const setState: Dispatch<SetStateAction<ItemT>> = useCallback(
        (newState: SetStateAction<ItemT>) => {
            // Update local state in ref
            state.value = isFunction(newState) ? (newState as (prevState: ItemT) => ItemT)(state.value!) : newState;
            // Trigger item to re-render
            setRenderNum((v) => v + 1);
            // Trigger container to re-render to update item size
            triggerLayout();
        },
        [triggerLayout, state],
    );

    return [state.value, setState] as const;
}

export function useIsLastItem(): boolean {
    const { itemKey } = useContext(ContextContainer);
    const isLast = useSelector$("lastItemKeys", (lastItemKeys) => lastItemKeys?.includes(itemKey) || false);
    return isLast;
}

export function useListScrollSize(): { width: number; height: number } {
    const [scrollSize] = useArr$(["scrollSize"]);
    return scrollSize;
}

const noop = () => {};
export function useSyncLayout() {
    if (IsNewArchitecture) {
        const { triggerLayout: syncLayout } = useContext(ContextContainer);

        return syncLayout;
    } else {
        // Old architecture doesn't support sync layout so there's no point in triggering
        // a state update for no reason
        return noop;
    }
}
