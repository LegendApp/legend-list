import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useStateContext } from "./state";
import type { LegendListRecyclingState, ViewabilityAmountCallback, ViewabilityCallback } from "./types";
import { useInit } from "./useInit";

interface ContextContainerType {
    containerId: number;
    itemKey: string;
    index: number;
    value: any;
    triggerLayout: () => void;
}

export const ContextContainer = createContext<ContextContainerType>(null as any);

export function useViewability(callback: ViewabilityCallback, configId?: string) {
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

export function useViewabilityAmount(callback: ViewabilityAmountCallback) {
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
        let ret: void | (() => void) = undefined;
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

        return ret;
    }, [index, value]);
}

export function useRecyclingState(valueOrFun: ((info: LegendListRecyclingState<unknown>) => any) | any) {
    const { index, value, triggerLayout } = useContext(ContextContainer);
    const [state, setState_] = useState(() =>
        typeof valueOrFun === "function"
            ? valueOrFun({
                  index,
                  item: value,
                  prevIndex: undefined,
                  prevItem: undefined,
              })
            : valueOrFun,
    );
    const setState = useCallback(
        (newState: any) => {
            setState_(newState);
            triggerLayout();
        },
        [triggerLayout],
    );

    useRecyclingEffect((state) => {
        const newState = typeof valueOrFun === "function" ? valueOrFun(state) : valueOrFun;
        setState_(newState);
    });

    return [state, setState];
}
