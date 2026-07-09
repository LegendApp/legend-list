import {
    createContext,
    type Dispatch,
    type SetStateAction,
    useCallback,
    useContext,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
} from "react";

import { IsNewArchitecture } from "@/constants-platform";
import { useInit } from "@/hooks/useInit";
import { type ContainerItemInfo, listen$, peek$, useArr$, useSelector$, useStateContext } from "@/state/state";
import type {
    AdaptiveRender,
    LegendListRecyclingState,
    ViewabilityAmountCallback,
    ViewabilityCallback,
} from "@/types.base";
import { isFunction, isNullOrUndefined } from "@/utils/helpers";

export interface ContextContainerType {
    containerId: number;
    triggerLayout: () => void;
}

export const ContextContainer = createContext<ContextContainerType | null>(null);
const NO_CONTAINER_ID = -1;

function useContextContainer(): ContextContainerType | null {
    return useContext(ContextContainer);
}

function useContainerItemInfo(containerContext: ContextContainerType | null): ContainerItemInfo | undefined {
    const containerId = containerContext?.containerId ?? NO_CONTAINER_ID;
    const [itemInfo] = useArr$([`containerItemInfo${containerId}`]);

    return containerContext ? itemInfo : undefined;
}

function useContainerItemKey(containerContext: ContextContainerType | null) {
    const containerId = containerContext?.containerId ?? NO_CONTAINER_ID;
    const [itemKey] = useArr$([`containerItemKey${containerId}`]);

    return containerContext ? (itemKey as string | undefined) : undefined;
}

export function useAdaptiveRender(): AdaptiveRender {
    const [mode] = useArr$(["adaptiveRender"]);
    return mode;
}

export function useAdaptiveRenderChange(callback: (mode: AdaptiveRender) => void) {
    const ctx = useStateContext();
    const callbackRef = useRef(callback);
    callbackRef.current = callback;

    useLayoutEffect(() => {
        let mode = peek$(ctx, "adaptiveRender");
        return listen$(ctx, "adaptiveRender", (nextMode) => {
            if (mode !== nextMode) {
                mode = nextMode;
                callbackRef.current(nextMode);
            }
        });
    }, [ctx]);
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
    const itemInfo = useContainerItemInfo(containerContext);
    const prevInfo = useRef<ContainerItemInfo | undefined>(undefined);

    useEffect(() => {
        if (!itemInfo) {
            return;
        }

        let ret: void | (() => void);
        if (prevInfo.current) {
            ret = effect({
                index: itemInfo.index,
                item: itemInfo.value,
                prevIndex: prevInfo.current.index,
                prevItem: prevInfo.current.value,
            });
        }

        prevInfo.current = itemInfo;

        return ret!;
    }, [effect, itemInfo]);
}

export function useRecyclingState<ItemT>(valueOrFun: ((info: LegendListRecyclingState<ItemT>) => ItemT) | ItemT) {
    const containerContext = useContextContainer();
    const itemInfo = useContainerItemInfo(containerContext);
    const computeValue = (info: ContainerItemInfo | undefined) => {
        if (isFunction(valueOrFun)) {
            const initializer = valueOrFun as (recyclingInfo: LegendListRecyclingState<ItemT>) => ItemT;
            return info
                ? initializer({
                      index: info.index,
                      item: info.value,
                      prevIndex: undefined,
                      prevItem: undefined,
                  })
                : (initializer as () => ItemT)();
        }
        return valueOrFun;
    };

    const [stateValue, setStateValue] = useState<ItemT>(() => {
        return computeValue(itemInfo);
    });
    const prevItemKeyRef = useRef<string | null>(itemInfo?.itemKey ?? null);

    // Reset state when the recycled item changes (synchronously to avoid extra renders)
    if (itemInfo && prevItemKeyRef.current !== itemInfo.itemKey) {
        prevItemKeyRef.current = itemInfo.itemKey;
        setStateValue(computeValue(itemInfo));
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
    const itemKey = useContainerItemKey(containerContext);

    const isLast = useSelector$("lastItemKeys", (lastItemKeys) => {
        // Fail gracefully if used outside context
        if (containerContext && !isNullOrUndefined(itemKey)) {
            return lastItemKeys?.includes(itemKey) || false;
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
    return IsNewArchitecture && containerContext ? containerContext.triggerLayout : noop;
}
