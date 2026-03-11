// biome-ignore lint/style/useImportType: Leaving this out makes it crash in some environments
import * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { PositionView, PositionViewSticky } from "@/components/PositionView";
import { Separator } from "@/components/Separator";
import { IsNewArchitecture } from "@/constants-platform";
import { useOnLayoutSync } from "@/hooks/useOnLayoutSync";
import { Platform } from "@/platform/Platform";
import type { DimensionValue, LayoutRectangle, LooseView, StyleProp, ViewStyle } from "@/platform/scrollview-types";
import { ContextContainer, type ContextContainerType } from "@/state/ContextContainer";
import { useArr$, useStateContext } from "@/state/state";
import { type GetRenderedItem, type StickyHeaderConfig, typedMemo } from "@/types.base";
import { isNullOrUndefined, roundSize } from "@/utils/helpers";
import { isInMVCPActiveMode } from "@/utils/isInMVCPActiveMode";

// biome-ignore lint/nursery/noShadow: const function name shadowing is intentional
export const Container = typedMemo(function Container<ItemT>({
    id,
    recycleItems,
    horizontal,
    getRenderedItem,
    updateItemSize,
    ItemSeparatorComponent,
    stickyHeaderConfig,
}: {
    id: number;
    recycleItems?: boolean;
    horizontal: boolean;
    getRenderedItem: GetRenderedItem;
    updateItemSize: (itemKey: string, size: { width: number; height: number }) => void;
    ItemSeparatorComponent?: React.ComponentType<{ leadingItem: ItemT }>;
    stickyHeaderConfig?: StickyHeaderConfig;
}) {
    const ctx = useStateContext();
    const { columnWrapperStyle, animatedScrollY } = ctx;
    const positionComponentInternal = ctx.state.props.positionComponentInternal;
    const stickyPositionComponentInternal = ctx.state.props.stickyPositionComponentInternal;

    const [column = 0, span = 1, data, itemKey, numColumns = 1, extraData, isSticky] = useArr$([
        `containerColumn${id}`,
        `containerSpan${id}`,
        `containerItemData${id}`,
        `containerItemKey${id}`,
        "numColumns",
        "extraData",
        `containerSticky${id}`,
    ]);

    const itemLayoutRef = useRef<{
        horizontal: boolean;
        itemKey?: string | undefined;
        lastSize?: { width: number; height: number };
        didLayout: boolean;
        pendingShrinkToken: number;
        updateItemSize: (key: string, size: { width: number; height: number }) => void;
    }>({
        didLayout: false,
        horizontal,
        itemKey,
        pendingShrinkToken: 0,
        updateItemSize,
    });
    itemLayoutRef.current.horizontal = horizontal;
    itemLayoutRef.current.itemKey = itemKey;
    itemLayoutRef.current.updateItemSize = updateItemSize;
    const ref = useRef<LooseView>(null);
    const [layoutRenderCount, forceLayoutRender] = useState(0);

    const resolvedColumn = column > 0 ? column : 1;
    const resolvedSpan = Math.min(Math.max(span || 1, 1), numColumns);
    const otherAxisPos: DimensionValue | undefined =
        numColumns > 1 ? `${((resolvedColumn - 1) / numColumns) * 100}%` : 0;
    const otherAxisSize: DimensionValue | undefined =
        numColumns > 1 ? `${(resolvedSpan / numColumns) * 100}%` : undefined;
    // Style is memoized because it's used as a dependency in PositionView.
    // It's unlikely to change since the position is usually the only style prop that changes.
    const style: StyleProp<ViewStyle> = useMemo(() => {
        let paddingStyles: ViewStyle | undefined;
        if (columnWrapperStyle) {
            // Extract gap properties from columnWrapperStyle if available
            const { columnGap, rowGap, gap } = columnWrapperStyle;

            // Create padding styles for both horizontal and vertical layouts with multiple columns
            if (horizontal) {
                paddingStyles = {
                    paddingRight: columnGap || gap || undefined,
                    paddingVertical: numColumns > 1 ? (rowGap || gap || 0) / 2 : undefined,
                };
            } else {
                paddingStyles = {
                    paddingBottom: rowGap || gap || undefined,
                    paddingHorizontal: numColumns > 1 ? (columnGap || gap || 0) / 2 : undefined,
                };
            }
        }

        return horizontal
            ? {
                  flexDirection: ItemSeparatorComponent ? "row" : undefined,
                  height: otherAxisSize,
                  left: 0,
                  position: "absolute",
                  top: otherAxisPos,
                  ...(paddingStyles || {}),
              }
            : {
                  left: otherAxisPos,
                  position: "absolute",
                  right: numColumns > 1 ? null : 0,
                  top: 0,
                  width: otherAxisSize,
                  ...(paddingStyles || {}),
              };
    }, [horizontal, otherAxisPos, otherAxisSize, columnWrapperStyle, numColumns]);

    const renderedItemInfo = useMemo(
        () => (itemKey !== undefined ? getRenderedItem(itemKey) : null),
        [itemKey, data, extraData],
    );
    const { index, renderedItem } = renderedItemInfo || {};

    const contextValue = useMemo<ContextContainerType>(() => {
        ctx.viewRefs.set(id, ref);
        return {
            containerId: id,
            index: index!,
            itemKey,
            triggerLayout: () => {
                forceLayoutRender((v) => v + 1);
            },
            value: data,
        };
    }, [id, itemKey, index, data]);

    const onLayoutChange = useCallback((rectangle: LayoutRectangle) => {
        const {
            horizontal: currentHorizontal,
            itemKey: currentItemKey,
            updateItemSize: updateItemSizeFn,
            lastSize,
            pendingShrinkToken,
        } = itemLayoutRef.current;

        if (isNullOrUndefined(currentItemKey)) {
            return;
        }

        itemLayoutRef.current.didLayout = true;
        let layout: { width: number; height: number } = rectangle;

        // Apply a small rounding so we don't run callbacks for tiny changes
        const axis = currentHorizontal ? "width" : "height";
        const size = roundSize(rectangle[axis]);
        const prevSize = lastSize ? roundSize(lastSize[axis]) : undefined;

        const doUpdate = () => {
            itemLayoutRef.current.lastSize = layout;
            updateItemSizeFn(currentItemKey, layout);
            itemLayoutRef.current.didLayout = true;
        };

        // On web, ResizeObserver can report a brief shrink while images are loading.
        // Applying that immediately causes MVCP scroll churn, so confirm the shrink next frame.
        // The token ensures we ignore stale frames if a newer layout arrives first.
        // During active MVCP we need immediate size updates so anchor math stays in sync.
        const shouldDeferWebShrinkLayoutUpdate =
            Platform.OS === "web" && !isInMVCPActiveMode(ctx.state) && prevSize !== undefined && size + 1 < prevSize;
        if (shouldDeferWebShrinkLayoutUpdate) {
            const token = pendingShrinkToken + 1;
            itemLayoutRef.current.pendingShrinkToken = token;
            requestAnimationFrame(() => {
                if (itemLayoutRef.current.pendingShrinkToken !== token) {
                    return;
                }

                const element = ref.current as unknown as HTMLElement | null;
                const rect = element?.getBoundingClientRect?.();
                if (rect) {
                    layout = { height: rect.height, width: rect.width };
                }

                doUpdate();
            });
            return;
        }

        if (IsNewArchitecture || size > 0) {
            doUpdate();
        } else {
            // On old architecture, the size can be 0 sometimes, maybe when not fully rendered?
            // So we need to make sure it's actually rendered and measure it to make sure it's actually 0.
            ref.current?.measure?.((_x, _y, width, height) => {
                layout = { height, width };
                doUpdate();
            });
        }
    }, []);

    const { onLayout } = useOnLayoutSync(
        {
            onLayoutChange,
            ref,
            webLayoutResync: () => isInMVCPActiveMode(ctx.state) && !ctx.state.scrollingTo,
        },
        [itemKey, layoutRenderCount],
    );

    if (!IsNewArchitecture) {
        // Since old architecture cannot use unstable_getBoundingClientRect it needs to ensure that
        // all containers updateItemSize even if the container did not resize.
        useEffect(() => {
            // Catch a bug where a container is reused and is the exact same size as the previous item
            // so it does not fire an onLayout, so we need to trigger it manually.
            // TODO: There must be a better way to do this?
            if (!isNullOrUndefined(itemKey)) {
                // Reset the didLayoutRef to false so that the item layout will be
                // updated even if the container is the exact same size as the previous item
                // because it would not fire an onLayout event.
                itemLayoutRef.current.didLayout = false;

                const timeout = setTimeout(() => {
                    if (!itemLayoutRef.current.didLayout) {
                        const {
                            itemKey: currentItemKey,
                            lastSize,
                            updateItemSize: updateItemSizeFn,
                        } = itemLayoutRef.current;

                        if (lastSize && !isNullOrUndefined(currentItemKey)) {
                            updateItemSizeFn(currentItemKey, lastSize);
                            itemLayoutRef.current.didLayout = true;
                        }
                    }
                }, 16);
                return () => {
                    clearTimeout(timeout);
                };
            }
        }, [itemKey]);
    }

    const PositionComponent = isSticky
        ? stickyPositionComponentInternal
            ? stickyPositionComponentInternal
            : PositionViewSticky
        : positionComponentInternal
          ? positionComponentInternal
          : PositionView;

    return (
        <PositionComponent
            animatedScrollY={isSticky ? animatedScrollY : undefined}
            horizontal={horizontal}
            id={id}
            index={index!}
            key={recycleItems ? undefined : itemKey}
            onLayout={onLayout}
            refView={ref as React.RefObject<any>}
            stickyHeaderConfig={stickyHeaderConfig}
            style={style as any}
        >
            <ContextContainer.Provider value={contextValue}>
                {renderedItem}
                {renderedItemInfo && ItemSeparatorComponent && (
                    <Separator ItemSeparatorComponent={ItemSeparatorComponent} leadingItem={renderedItemInfo.item} />
                )}
            </ContextContainer.Provider>
        </PositionComponent>
    );
});
