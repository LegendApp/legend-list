import * as React from "react";

import { IsNewArchitecture } from "@/constants-platform";
import { batchItemSizeUpdates } from "@/core/updateItemSizes";
import { Platform } from "@/platform/Platform";
import type { LooseScrollViewProps } from "@/platform/scrollview-types";
import { peek$, useStateContext } from "@/state/state";
import type { LegendListPropsBase } from "@/types.internal";
import { expect, mock } from "bun:test";
import TestRenderer, { act, type ReactTestRenderer } from "../helpers/testRenderer";
import { installFakeClock } from "../helpers/webScrollHarness";

const data = Array.from({ length: 30 }, (_, index) => String(index));
const itemSize = 50;
const getFixedItemSize = () => itemSize;
const keyExtractor = (item: string) => item;
const Empty = () => <div data-empty />;

type Props = Partial<Extract<LegendListPropsBase<string, LooseScrollViewProps>, { data: readonly string[] }>>;
type ScrollPhase = "onScroll" | "onScrollBeginDrag" | "onScrollEndDrag" | "onMomentumScrollBegin";

export async function mountList(platform: "android" | "ios" | "web", overrides: Props = {}, legacy = false) {
    Platform.OS = platform;
    const clock = installFakeClock();
    const emitResize = { current: undefined as ((entry: ResizeObserverEntry) => void) | undefined };
    const viewport = {
        getBoundingClientRect: () => ({ height: 0, left: 0, top: 0, width: 0 }),
    };
    const originalHTMLElement = globalThis.HTMLElement;
    if (platform === "web") {
        const [containers, positionView, onLayoutSync, windowSize, scrollAdjust] = await Promise.all([
            import("../../src/components/Containers?show-immediately-web"),
            import("../../src/components/PositionView?show-immediately-web"),
            import("../../src/hooks/useOnLayoutSync?show-immediately-web"),
            import("../../src/platform/getWindowSize?show-immediately-web"),
            import("../../src/components/ScrollAdjust?show-immediately-web"),
        ]);
        const { Containers } = containers;
        const { PositionView, PositionViewSticky } = positionView;
        const { useOnLayoutSync } = onLayoutSync;
        const { getWindowSize } = windowSize;
        const { ScrollAdjust } = scrollAdjust;
        mock.module("@/components/Containers", () => ({ Containers }));
        mock.module("@/components/PositionView", () => ({ PositionView, PositionViewSticky }));
        mock.module("@/hooks/useOnLayoutSync", () => ({ useOnLayoutSync }));
        mock.module("@/platform/getWindowSize", () => ({ getWindowSize }));
        mock.module("@/components/ScrollAdjust", () => ({ ScrollAdjust }));
        mock.module("@/hooks/createResizeObserver", () => ({
            createResizeObserver: (element: unknown, callback: (entry: ResizeObserverEntry) => void) => {
                if (element === viewport) emitResize.current = callback;
            },
        }));
        globalThis.HTMLElement = class {} as typeof HTMLElement;
    }
    if (legacy) {
        mock.module("@/constants-platform", () => ({ IsNewArchitecture: false }));
    }
    expect(IsNewArchitecture).toBe(!legacy);

    const { LegendList } = await import("../../src/components/LegendList?show-immediately");
    const scrollWrites: number[] = [];
    let scroll = 0;
    let nativeProps: LooseScrollViewProps;
    let ctx!: ReturnType<typeof useStateContext>;
    const committed = new Map<symbol, string>();
    let firstCommit: Array<[string, number | undefined]> | undefined;

    const snapshot = () =>
        [...committed.values()]
            .map((key): [string, number | undefined] => [
                key,
                peek$(ctx, `containerPosition${ctx.state.containerItemKeys.get(key)}` as `containerPosition${number}`),
            ])
            .sort((a, b) => a[1]! - b[1]!);

    function Row({ item }: { item: string }) {
        React.useLayoutEffect(() => {
            const instance = Symbol();
            committed.set(instance, item);
            return () => {
                committed.delete(instance);
            };
        }, [item]);
        return <div data-row={item} />;
    }

    function Surface(
        props: LooseScrollViewProps & {
            children?: React.ReactNode;
            ref?: React.Ref<unknown>;
        },
    ) {
        const { children, contentOffset, ref } = props;
        ctx = useStateContext();
        nativeProps = props;
        React.useImperativeHandle(ref, () => ({
            getCurrentScrollOffset: () => scroll,
            getScrollableNode: () => viewport,
            measure: () => {},
            scrollTo: ({ x, y }: { x: number; y: number }) => {
                scroll = overrides.horizontal ? x : y;
                scrollWrites.push(scroll);
            },
        }));
        React.useLayoutEffect(() => {
            scroll = (overrides.horizontal ? contentOffset?.x : contentOffset?.y) ?? 0;
            firstCommit = snapshot();
        }, []);
        return <>{children}</>;
    }
    const list = (props: Props) => (
        <LegendList
            data={data}
            drawDistance={0}
            estimatedListSize={{ height: 150, width: 200 }}
            getFixedItemSize={getFixedItemSize}
            keyExtractor={keyExtractor}
            recycleItems={false}
            renderItem={({ item }: { item: string }) => <Row item={item} />}
            renderScrollComponent={(scrollProps: LooseScrollViewProps) => <Surface {...scrollProps} />}
            showImmediately
            {...props}
        />
    );

    let mounted: ReactTestRenderer | undefined;
    return {
        context: () => ctx,
        emitScroll: (y: number, phase: ScrollPhase = "onScroll") => {
            scroll = y;
            act(() =>
                nativeProps[phase]!({
                    nativeEvent: {
                        contentInset: { bottom: 0, left: 0, right: 0, top: 0 },
                        contentOffset: { x: 0, y },
                        contentSize: { height: ctx.state.totalSize, width: 250 },
                        layoutMeasurement: { height: ctx.state.scrollLength, width: 250 },
                        zoomScale: 1,
                    },
                }),
            );
        },
        endPadding: () => peek$(ctx, "alignItemsAtEndPadding") ?? 0,
        firstCommit: () => firstCommit,
        layout: (size: number) => {
            const layout = overrides.horizontal
                ? { height: 250, width: size, x: 0, y: 0 }
                : { height: size, width: 250, x: 0, y: 0 };
            act(() => {
                if (platform === "web") {
                    expect(emitResize.current).toBeDefined();
                    emitResize.current?.({
                        borderBoxSize: [{ blockSize: layout.height, inlineSize: layout.width }],
                        contentRect: { left: 0, top: 0 },
                        target: viewport,
                    } as unknown as ResizeObserverEntry);
                } else {
                    nativeProps.onLayout!({ nativeEvent: { layout } });
                }
            });
        },
        measureRows: (getHeight: (key: string) => number | undefined) => {
            const views = mounted!.root.findAll(
                (node) => typeof node.type !== "string" && typeof node.props.id === "number" && !!node.props.refView,
            );
            act(() =>
                batchItemSizeUpdates(() => {
                    for (const view of views) {
                        const key = peek$(ctx, `containerItemKey${view.props.id}`);
                        const height = key === undefined ? undefined : getHeight(key);
                        if (height === undefined) continue;
                        view.props.onLayout({
                            nativeEvent: { layout: { height, width: 250, x: 0, y: 0 } },
                        });
                    }
                }),
            );
        },
        mount: () =>
            act(() => {
                mounted = TestRenderer.create(list(overrides));
            }),
        nativeContentStyle: () => {
            const tree = mounted!.toJSON();
            return Array.isArray(tree) ? tree.find((node) => node.type === "AnimatedView")?.props.style : undefined;
        },
        offset: () => scroll,
        renderedRange: () => [ctx.state.startBuffered, ctx.state.endBuffered],
        rerender: (props: Props) => act(() => mounted!.update(list({ ...overrides, ...props }))),
        rows: () => snapshot(),
        scrollWrites,
        state: () => ctx.state,
        tick: () => act(() => clock.tick()),
        tree: () => mounted!.toJSON(),
        unmount: () => {
            act(() => mounted?.unmount());
            clock.restore();
            globalThis.HTMLElement = originalHTMLElement;
        },
    };
}

export function positions(first: number, last: number, offset = 0): Array<[string, number]> {
    return Array.from({ length: last - first + 1 }, (_, i) => [String(offset + first + i), (first + i) * itemSize]);
}

export { Empty };
