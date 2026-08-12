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
import { listen$, peek$, useArr$, useSelector$, useStateContext } from "@/state/state";
import type {
    AdaptiveRender,
    LegendListRecyclingState,
    ViewabilityAmountCallback,
    ViewabilityCallback,
} from "@/types.base";
import { IS_DEV } from "@/utils/devEnvironment";
import { isFunction, isNullOrUndefined, warnDevOnce } from "@/utils/helpers";

export interface ContextContainerType {
    containerId: number;
    triggerLayout: () => void;
}

export const ContextContainer = createContext<ContextContainerType | null>(null);
const NO_CONTAINER_ID = -1;

function useContextContainer(): ContextContainerType | null {
    return useContext(ContextContainer);
}

function useContainerItemSignals(containerContext: ContextContainerType | null) {
    const containerId = containerContext?.containerId ?? NO_CONTAINER_ID;
    const [itemKey, itemIndex, item] = useArr$([
        `containerItemKey${containerId}`,
        `containerItemIndex${containerId}`,
        `containerItemData${containerId}`,
    ]);

    return {
        hasItemInfo: !!containerContext && itemKey !== undefined && itemIndex !== undefined,
        item,
        itemIndex,
        itemKey,
    };
}

function scheduleViewabilityConfigWarning(
    ctx: ReturnType<typeof useStateContext>,
    hookName: "useViewability" | "useViewabilityAmount",
    configId?: string,
) {
    let cancelled = false;

    Promise.resolve().then(() => {
        const viewabilityConfigCallbackPairs = ctx.state?.viewabilityConfigCallbackPairs;
        if (!cancelled && ctx.state) {
            if (!viewabilityConfigCallbackPairs?.length) {
                warnDevOnce(
                    `${hookName}-missing-viewability-config`,
                    `${hookName} requires viewability to be configured on the owning LegendList. Add viewabilityConfig with a visibility threshold.`,
                );
            } else if (
                hookName === "useViewability" &&
                !viewabilityConfigCallbackPairs.some((pair) => pair.viewabilityConfig.id === (configId ?? ""))
            ) {
                const configDescription = configId ? ` for configId "${configId}"` : "";
                warnDevOnce(
                    `${hookName}-missing-viewability-config-${configId ?? "default"}`,
                    `${hookName}${configDescription} requires a matching viewabilityConfig.id on the owning LegendList. Add an id to viewabilityConfig and pass the same id to useViewability.`,
                );
            }
        }
    });

    return () => {
        cancelled = true;
    };
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
        const cancelConfigWarning = IS_DEV
            ? scheduleViewabilityConfigWarning(ctx, "useViewability", configId)
            : undefined;

        return () => {
            cancelConfigWarning?.();
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
        const cancelConfigWarning = IS_DEV ? scheduleViewabilityConfigWarning(ctx, "useViewabilityAmount") : undefined;

        return () => {
            cancelConfigWarning?.();
            ctx.mapViewabilityAmountCallbacks.delete(containerId);
        };
    }, [ctx, callback, containerContext]);
}

export function useRecyclingEffect(effect: (info: LegendListRecyclingState<unknown>) => void | (() => void)) {
    const containerContext = useContextContainer();
    const { hasItemInfo, item, itemIndex, itemKey } = useContainerItemSignals(containerContext);
    const prevInfo = useRef<{ index: number; item: unknown } | undefined>(undefined);

    useEffect(() => {
        if (!hasItemInfo) {
            return;
        }

        let ret: void | (() => void);
        if (prevInfo.current) {
            ret = effect({
                index: itemIndex,
                item,
                prevIndex: prevInfo.current.index,
                prevItem: prevInfo.current.item,
            });
        }

        prevInfo.current = {
            index: itemIndex,
            item,
        };

        return ret!;
    }, [effect, hasItemInfo, itemIndex, item, itemKey]);
}

export function useRecyclingState<ItemT>(valueOrFun: ((info: LegendListRecyclingState<ItemT>) => ItemT) | ItemT) {
    const containerContext = useContextContainer();
    const { hasItemInfo, item, itemIndex, itemKey } = useContainerItemSignals(containerContext);
    const computeValue = () => {
        if (isFunction(valueOrFun)) {
            const initializer = valueOrFun as (recyclingInfo: LegendListRecyclingState<ItemT>) => ItemT;
            return hasItemInfo
                ? initializer({
                      index: itemIndex,
                      item,
                      prevIndex: undefined,
                      prevItem: undefined,
                  })
                : (initializer as () => ItemT)();
        }
        return valueOrFun;
    };

    const [stateValue, setStateValue] = useState<ItemT>(() => {
        return computeValue();
    });
    const prevItemKeyRef = useRef<string | null>(hasItemInfo ? itemKey : null);

    // Reset state when the recycled item changes (synchronously to avoid extra renders)
    if (hasItemInfo && prevItemKeyRef.current !== itemKey) {
        prevItemKeyRef.current = itemKey;
        setStateValue(computeValue());
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
    const containerId = containerContext?.containerId ?? NO_CONTAINER_ID;
    const [itemKey] = useArr$([`containerItemKey${containerId}`]);

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
