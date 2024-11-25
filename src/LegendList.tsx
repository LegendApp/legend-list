import * as React from 'react';
import { ForwardedRef, forwardRef, ReactElement, useMemo, useRef } from 'react';
import { Dimensions, ScrollView, StyleSheet } from 'react-native';
import { DEFAULT_SCROLL_BUFFER } from './constants';
import {
    allocateContainers,
    applyDefaultProps,
    calculateInitialOffset as calculateInitialOffsetHelper,
    calculateItemsInView as calculateItemsInViewHelper,
    checkAtBottom as checkAtBottomHelper,
    getId as getIdHelper,
    getItemSize as getItemSizeHelper,
    getRenderedItem as getRenderedItemHelper,
    handleScrollDebounced as handleScrollDebouncedHelper,
    handleScroll as handleScrollHelper,
    onLayout as onLayoutHelper,
    addTotalSize as addTotalSizeHelper,
    updateItemSize as updateItemSizeHelper,
} from './LegendListHelpers';
import { ListComponent } from './ListComponent';
import { peek$, set$, StateProvider, useStateContext } from './state';
import type { InternalState, LegendListProps } from './types';
import { setupViewability } from './viewability';

export const LegendList: <T>(props: LegendListProps<T> & { ref?: ForwardedRef<ScrollView> }) => ReactElement =
    forwardRef(function LegendList<T>(props: LegendListProps<T>, forwardedRef: ForwardedRef<ScrollView>) {
        return (
            <StateProvider>
                <LegendListInner {...props} ref={forwardedRef} />
            </StateProvider>
        );
    }) as any;

const LegendListInner: <T>(props: LegendListProps<T> & { ref?: ForwardedRef<ScrollView> }) => ReactElement = forwardRef(
    function LegendListInner<T>(props_: LegendListProps<T>, forwardedRef: ForwardedRef<ScrollView>) {
        const props = applyDefaultProps(props_);
        const {
            data,
            initialScrollIndex,
            initialScrollOffset,
            horizontal,
            style: styleProp,
            contentContainerStyle: contentContainerStyleProp,
            drawDistance,
            ...rest
        } = props;

        const ctx = useStateContext();

        const refScroller = (forwardedRef || useRef<ScrollView>(null)) as React.MutableRefObject<ScrollView>;
        const scrollBuffer = drawDistance ?? DEFAULT_SCROLL_BUFFER;
        // Experimental: It works ok on iOS when scrolling up, but is doing weird things when sizes are changing.
        // And it doesn't work at all on Android because it uses contentInset. I'll try it again later.
        // Ideally it would work by adjusting the contentOffset but in previous attempts that was causing jitter.
        const supportsEstimationAdjustment = false; //   Platform.OS === "ios";

        const refState = useRef<InternalState<T>>();

        const initialContentOffset =
            initialScrollOffset ?? useMemo(calculateInitialOffsetHelper.bind(undefined, props), []);

        if (!refState.current) {
            refState.current = {
                sizes: new Map(),
                positions: new Map(),
                pendingAdjust: 0,
                animFrameScroll: null,
                animFrameLayout: null,
                isStartReached: false,
                isEndReached: false,
                isAtBottom: false,
                idsInFirstRender: undefined as any,
                hasScrolled: false,
                scrollSize: Dimensions.get('window')[horizontal ? 'width' : 'height'],
                startBuffered: 0,
                startNoBuffer: 0,
                endBuffered: 0,
                endNoBuffer: 0,
                scroll: initialContentOffset || 0,
                scrollPrevious: initialContentOffset || 0,
                previousViewableItems: new Set(),
                props,
                ctx,
                scrollBuffer,
                updateViewableItems: undefined,
                timeouts: new Set(),
            };
            refState.current.idsInFirstRender = new Set(
                data.map((_: any, i: number) => getIdHelper(refState.current!, i)),
            );
        }
        refState.current.props = props;
        refState.current.ctx = ctx;

        const styleFlattened = StyleSheet.flatten(styleProp);
        const style = useMemo(() => styleFlattened, [JSON.stringify(styleProp)]);
        const contentContainerStyleFlattened = StyleSheet.flatten(contentContainerStyleProp);
        const contentContainerStyle = useMemo(
            () => contentContainerStyleFlattened,
            [JSON.stringify(contentContainerStyleProp)],
        );

        // Create functions that are bound to the state to avoid re-creating them on every render.
        // This should be a minor optimization when data is changing often. And putting them elsewhere
        // makes sure we always get the latest values from state and avoid accidentally using stale values.
        const fns = useMemo(
            () => ({
                getRenderedItem: getRenderedItemHelper.bind(undefined, refState.current!),
                getId: getIdHelper.bind(undefined, refState.current!),
                getItemSize: getItemSizeHelper.bind(undefined, refState.current!),
                calculateItemsInView: calculateItemsInViewHelper.bind(undefined, refState.current!),
                updateItemSize: updateItemSizeHelper.bind(undefined, refState.current!, refScroller),
                checkAtBottom: checkAtBottomHelper.bind(undefined, refState.current!),
                handleScrollDebounced: handleScrollDebouncedHelper.bind(undefined, refState.current!),
                onLayout: onLayoutHelper.bind(undefined, refState.current!),
                addTotalSize: addTotalSizeHelper.bind(undefined, refState.current!),
                handleScroll: handleScrollHelper.bind(
                    undefined,
                    refState.current!,
                    handleScrollDebouncedHelper.bind(undefined, refState.current!),
                ),
            }),
            [],
        );
        const {
            calculateItemsInView,
            getId,
            getItemSize,
            checkAtBottom,
            updateItemSize,
            getRenderedItem,
            onLayout,
            handleScroll,
            addTotalSize,
        } = fns;

        set$(ctx, `numItems`, data.length);
        // TODO: This needs to support horizontal and other ways of defining padding.
        set$(ctx, `stylePaddingTop`, styleFlattened?.paddingTop ?? contentContainerStyleFlattened?.paddingTop ?? 0);

        // const adjustTopPad = (diff: number) => {
        //     // TODO: Experimental, find a better way to do this.
        //     // Ideally we can do it by adjusting the contentOffset instead
        //     if (supportsEstimationAdjustment) {
        //         visibleRange$.topPad.set((v) => v - diff);
        //         const topPad = visibleRange$.topPad.peek();
        //         if (topPad > 0) {
        //             if (Platform.OS === 'ios') {
        //                 scrollRef.current?.setNativeProps({
        //                     contentInset: { top: topPad },
        //                 });
        //             } else {
        //             }
        //         }
        //     }
        // };

        useMemo(() => {
            setupViewability(refState.current!);
            allocateContainers(refState.current!);
            calculateItemsInView();

            // Set an initial total height based on what we know
            const sizes = refState.current?.sizes!;
            let totalSize = (peek$(ctx, `headerSize`) || 0) + (peek$(ctx, `footerSize`) || 0);
            for (let i = 0; i < data.length; i++) {
                const id = getId(i);
                totalSize += sizes.get(id) ?? getItemSize(i, data[i]);
            }
            addTotalSize(totalSize);
        }, []);

        useMemo(() => {
            if (refState.current) {
                refState.current.isEndReached = false;
            }
            calculateItemsInView();
            checkAtBottom();
        }, [data]);

        return (
            <ListComponent
                {...rest}
                addTotalSize={addTotalSize}
                contentContainerStyle={contentContainerStyle}
                style={style}
                horizontal={horizontal!}
                refScroller={refScroller}
                initialContentOffset={initialContentOffset}
                getRenderedItem={getRenderedItem}
                updateItemSize={updateItemSize}
                handleScroll={handleScroll}
                onLayout={onLayout}
            />
        );
    },
) as <T>(props: LegendListProps<T> & { ref?: ForwardedRef<ScrollView> }) => ReactElement;
