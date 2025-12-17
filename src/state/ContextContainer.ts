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

import { IsNewArchitecture } from "@/constants-platform";
import { useInit } from "@/hooks/useInit";
import { useArr$, useSelector$, useStateContext } from "@/state/state";
import type { LegendListRecyclingState, ViewabilityAmountCallback, ViewabilityCallback } from "@/types";
import { isFunction, isNullOrUndefined } from "@/utils/helpers";

export interface ContextContainerType {
    containerId: number;
    itemKey: string;
    index: number;
    value: any;
    triggerLayout: () => void;
}

export const ContextContainer = createContext<ContextContainerType | null>(null);

function useContextContainer(): ContextContainerType | null {
    return useContext(ContextContainer);
}

export function useViewability<ItemT = any>(callback: ViewabilityCallback<ItemT>, configId?: string) {
    const ctx = useStateContext();
    const containerContext = useContextContainer();

    useInit(() => {
        // Fail gracefully if used outside context
        if (!containerContext) {
            return;
        }

        const { containerId } = containerContext;
        const key = containerId + (configId ?? "");
        const value = ctx.mapViewabilityValues.get(key);
        if (value) {
            callback(value);
        }
    });

    useEffect(() => {
        // Fail gracefully if used outside context
        if (!containerContext) {
            return;
        }

        const { containerId } = containerContext;
        const key = containerId + (configId ?? "");
        ctx.mapViewabilityCallbacks.set(key, callback);

        return () => {
            ctx.mapViewabilityCallbacks.delete(key);
        };
    }, [ctx, callback, configId, containerContext]);
}

export function useViewabilityAmount<ItemT = any>(callback: ViewabilityAmountCallback<ItemT>) {
    const ctx = useStateContext();
    const containerContext = useContextContainer();

    useInit(() => {
        // Fail gracefully if used outside context
        if (!containerContext) {
            return;
        }

        const { containerId } = containerContext;
        const value = ctx.mapViewabilityAmountValues.get(containerId);
        if (value) {
            callback(value);
        }
    });

    useEffect(() => {
        // Fail gracefully if used outside context
        if (!containerContext) {
            return;
        }

        const { containerId } = containerContext;
        ctx.mapViewabilityAmountCallbacks.set(containerId, callback);

        return () => {
            ctx.mapViewabilityAmountCallbacks.delete(containerId);
        };
    }, [ctx, callback, containerContext]);
}

export function useRecyclingEffect(effect: (info: LegendListRecyclingState<unknown>) => void | (() => void)) {
    const containerContext = useContextContainer();
    const prevValues = useRef<{ prevIndex: number | undefined; prevItem: any }>({
        prevIndex: undefined,
        prevItem: undefined,
    });

    useEffect(() => {
        // Fail gracefully if used outside context
        if (!containerContext) {
            return;
        }

        const { index, value } = containerContext;
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
    }, [effect, containerContext]);
}

export function useRecyclingState<ItemT>(valueOrFun: ((info: LegendListRecyclingState<ItemT>) => ItemT) | ItemT) {
    const containerContext = useContextContainer();
    const computeValue = (ctx: ContextContainerType | null) => {
        if (isFunction(valueOrFun)) {
            const initializer = valueOrFun as (info: LegendListRecyclingState<ItemT>) => ItemT;
            return ctx
                ? initializer({
                      index: ctx.index,
                      item: ctx.value,
                      prevIndex: undefined,
                      prevItem: undefined,
                  })
                : (initializer as () => ItemT)();
        }
        return valueOrFun;
    };

    const [stateValue, setStateValue] = useState<ItemT>(() => {
        // Initialize state value
        return computeValue(containerContext);
    });
    const prevItemKeyRef = useRef<string | null>(containerContext?.itemKey ?? null);

    // Reset state when the recycled item changes (synchronously to avoid extra renders)
    const currentItemKey = containerContext?.itemKey ?? null;
    if (currentItemKey !== null && prevItemKeyRef.current !== currentItemKey) {
        prevItemKeyRef.current = currentItemKey;
        setStateValue(computeValue(containerContext));
    }

    const triggerLayout = containerContext?.triggerLayout;
    const setState: Dispatch<SetStateAction<ItemT>> = useCallback(
        (newState: SetStateAction<ItemT>) => {
            // Fail gracefully if used outside context
            if (!triggerLayout) {
                return;
            }

            // Update state using setState
            setStateValue((prevValue) => {
                return isFunction(newState) ? (newState as (prevState: ItemT) => ItemT)(prevValue) : newState;
            });
            // Trigger container to re-render to update item size
            triggerLayout();
        },
        [triggerLayout],
    );

    return [stateValue, setState] as const;
}

export function useIsLastItem(): boolean {
    const containerContext = useContextContainer();

    const isLast = useSelector$("lastItemKeys", (lastItemKeys) => {
        // Fail gracefully if used outside context
        if (containerContext) {
            const { itemKey } = containerContext;
            if (!isNullOrUndefined(itemKey)) {
                return lastItemKeys?.includes(itemKey) || false;
            }
        }
        return false;
    });

    return isLast;
}

export function useListScrollSize(): { width: number; height: number } {
    const [scrollSize] = useArr$(["scrollSize"]);
    return scrollSize;
}

const noop = () => {};
export function useSyncLayout() {
    const containerContext = useContextContainer();

    if (IsNewArchitecture && containerContext) {
        const { triggerLayout: syncLayout } = containerContext;
        return syncLayout;
    } else {
        // Old architecture doesn't support sync layout so there's no point in triggering
        // a state update for no reason
        return noop;
    }
}
