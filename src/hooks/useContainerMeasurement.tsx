// biome-ignore lint/style/useImportType: Leaving this out makes it crash in some environments
import * as React from "react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { IsNewArchitecture } from "@/constants-platform";
import { scheduleContainerLayout } from "@/core/scheduleContainerLayout";
import { batchItemSizeUpdates, updateItemSizes } from "@/core/updateItemSizes";
import { useOnLayoutSync } from "@/hooks/useOnLayoutSync";
import { Platform } from "@/platform/Platform";
import type { LayoutRectangle, LooseView } from "@/platform/scrollview-types";
import type { StateContext } from "@/state/state";
import { roundSize } from "@/utils/helpers";
import { isInMVCPActiveMode } from "@/utils/isInMVCPActiveMode";

interface ContainerMeasurementState {
    didLayout: boolean;
    horizontal: boolean;
    itemKey: string;
    lastSize?: { height: number; width: number };
}

interface ProcessContainerLayoutOptions {
    containerId: number;
    ctx: StateContext;
    rectangle: LayoutRectangle;
    ref: React.RefObject<LooseView | null>;
    state: ContainerMeasurementState;
}

const pendingWebShrinkMeasurements = new Map<ContainerMeasurementState, () => void>();
let pendingWebShrinkFrame: number | undefined;

function cancelWebShrinkMeasurement(state: ContainerMeasurementState) {
    pendingWebShrinkMeasurements.delete(state);
}

function scheduleWebShrinkMeasurement(state: ContainerMeasurementState, confirmMeasurement: () => void) {
    pendingWebShrinkMeasurements.set(state, confirmMeasurement);

    if (pendingWebShrinkFrame === undefined) {
        // Brief observer shrinks can occur while web content is settling. Confirm all
        // pending shrinks together so the fallback costs one frame and one batch.
        pendingWebShrinkFrame = requestAnimationFrame(() => {
            const callbacks = Array.from(pendingWebShrinkMeasurements.values());
            pendingWebShrinkMeasurements.clear();
            pendingWebShrinkFrame = undefined;
            batchItemSizeUpdates(() => {
                for (const callback of callbacks) {
                    callback();
                }
            });
        });
    }
}

export function processContainerLayout({ containerId, ctx, rectangle, ref, state }: ProcessContainerLayoutOptions) {
    const listState = ctx.state;
    const currentItemKey = state.itemKey;
    const generation = listState.containerItemGenerations[containerId] ?? 0;
    state.didLayout = true;
    let layout: { height: number; width: number } = rectangle;
    const axis = state.horizontal ? "width" : "height";
    const size = roundSize(rectangle[axis]);
    const localPreviousSize = state.lastSize ? roundSize(state.lastSize[axis]) : undefined;
    const coreKnownSize = listState.sizesKnown.get(currentItemKey);
    // A recycled physical container may still hold the previous item's local size.
    // The core cache is authoritative for the item currently assigned on web.
    const previousSize = Platform.OS === "web" ? coreKnownSize : localPreviousSize;

    const applyLayout = () => {
        if (state.itemKey !== currentItemKey || (listState.containerItemGenerations[containerId] ?? 0) !== generation) {
            return;
        }
        state.lastSize = layout;
        updateItemSizes(ctx, {
            containerId,
            generation,
            itemKey: currentItemKey,
            size: layout,
        });
    };

    const shouldDeferWebShrinkLayoutUpdate =
        Platform.OS === "web" &&
        !isInMVCPActiveMode(listState) &&
        previousSize !== undefined &&
        size + 1 < previousSize;
    if (shouldDeferWebShrinkLayoutUpdate) {
        scheduleWebShrinkMeasurement(state, () => {
            if (state.itemKey === currentItemKey) {
                const element = ref.current as unknown as HTMLElement | null;
                const rect = element?.getBoundingClientRect?.();
                if (rect) {
                    layout = { height: rect.height, width: rect.width };
                }
                applyLayout();
            }
        });
    } else {
        if (Platform.OS === "web") {
            cancelWebShrinkMeasurement(state);
        }

        if (IsNewArchitecture || size > 0) {
            applyLayout();
        } else {
            ref.current?.measure?.((_x, _y, width, height) => {
                layout = { height, width };
                applyLayout();
            });
        }
    }
}

export function useContainerMeasurement({
    containerId,
    ctx,
    horizontal,
    itemKey,
    ref,
}: {
    containerId: number;
    ctx: StateContext;
    horizontal: boolean;
    itemKey: string;
    ref: React.RefObject<LooseView | null>;
}) {
    const stateRef = useRef<ContainerMeasurementState>({
        didLayout: false,
        horizontal,
        itemKey,
    });
    stateRef.current.horizontal = horizontal;
    stateRef.current.itemKey = itemKey;
    const [layoutRenderCount, forceLayoutRender] = useState(0);

    const onLayoutChange = useCallback(
        (rectangle: LayoutRectangle) => {
            processContainerLayout({ containerId, ctx, rectangle, ref, state: stateRef.current });
        },
        [containerId, ctx, ref],
    );

    const triggerLayout = useCallback(() => {
        if (IsNewArchitecture) {
            // Recycling hooks invalidate only their own physical slot. List-wide
            // operations such as clearCaches schedule an explicit all-container pass.
            scheduleContainerLayout(ctx, containerId);
        } else {
            forceLayoutRender((value) => value + 1);
        }
    }, [containerId, ctx]);

    useLayoutEffect(() => {
        ctx.containerLayoutTriggers.set(containerId, triggerLayout);
        return () => {
            cancelWebShrinkMeasurement(stateRef.current);
            if (ctx.containerLayoutTriggers.get(containerId) === triggerLayout) {
                ctx.containerLayoutTriggers.delete(containerId);
            }
        };
    }, [containerId, ctx, triggerLayout]);

    useLayoutEffect(() => {
        // Intentionally run after every Container commit: rendered row content may have
        // changed geometry even when the container identity did not. Child layout effects
        // merge their ids before the parent coordinator measures them in one pass.
        if (IsNewArchitecture) {
            scheduleContainerLayout(ctx, containerId);
        }
    });

    useLayoutEffect(() => {
        if (!IsNewArchitecture && layoutRenderCount > 0) {
            // Legacy onLayout does not fire when reset content has unchanged bounds.
            // Measure after the requested commit, retaining the async generation guard.
            onLayoutChange({ height: 0, width: 0, x: 0, y: 0 });
        }
    }, [layoutRenderCount, onLayoutChange]);

    const { onLayout } = useOnLayoutSync(
        {
            measureInLayoutEffect: !IsNewArchitecture,
            onLayoutChange,
            ref,
            webLayoutResync: () => isInMVCPActiveMode(ctx.state),
        },
        [itemKey, layoutRenderCount],
    );

    useEffect(() => {
        if (!IsNewArchitecture) {
            // Old architecture can recycle a view to an equal-sized item without emitting
            // another onLayout event, so replay the last size if no event arrives this frame.
            stateRef.current.didLayout = false;
            const timeout = setTimeout(() => {
                const state = stateRef.current;
                if (!state.didLayout && state.lastSize) {
                    updateItemSizes(ctx, {
                        containerId,
                        itemKey: state.itemKey,
                        size: state.lastSize,
                    });
                    state.didLayout = true;
                }
            }, 16);
            return () => {
                clearTimeout(timeout);
            };
        }
    }, [containerId, ctx, itemKey]);

    return { onLayout, triggerLayout };
}
