// biome-ignore lint/style/useImportType: Leaving this out makes it crash in some environments
import * as React from "react";
import {
    type CSSProperties,
    forwardRef,
    type HTMLAttributes,
    type ReactElement,
    type ReactNode,
    useCallback,
    useEffect,
    useImperativeHandle,
    useLayoutEffect,
    useRef,
} from "react";

import { interruptUserScroll } from "@/core/cancelScroll";
import { rearmEndFollowIfSettled } from "@/core/finishMaintainScrollAtEnd";
import type { LayoutRectangle, NativeSyntheticEvent } from "@/platform/platform-types";
import { StyleSheet } from "@/platform/StyleSheet";
import { listen$, peek$, useArr$, useStateContext } from "@/state/state";
import { IS_DEV } from "@/utils/devEnvironment";
import { hasActiveInitialScroll } from "@/utils/hasActiveInitialScroll";
import { warnDevOnce } from "@/utils/helpers";
import { isInMVCPActiveMode } from "@/utils/isInMVCPActiveMode";
import { getNativeHorizontalRTLScrollType, isHorizontalRTL, peekLogicalHorizontalOffset } from "@/utils/rtl";
import { useRafCoalescer } from "@/utils/useRafCoalescer";
import { getWheelGesture, normalizeWheelDelta, type WheelGesture } from "@/utils/wheelGesture";
import { observeScrollLayout } from "./observeScrollLayout";
import {
    LEGEND_LIST_CONTENT_CONTAINER_CLASS,
    LEGEND_LIST_SCROLLBAR_X_HIDDEN_CLASS,
    LEGEND_LIST_SCROLLBAR_Y_HIDDEN_CLASS,
} from "./webConstants";
import {
    clampOffset,
    getContentSize,
    getElementScrollPosition,
    getLayoutMeasurement,
    getLayoutRectangle,
    getMaxOffset,
    getScrollContentSize,
    getScrollPosition,
    isWindowTarget,
    ownsScrollInput,
    resolveExternalScrollOffset,
    resolveScrollableNode,
    resolveScrollEventTarget,
    type ScrollEventTarget,
} from "./webScrollUtils";

export type LayoutChangeEvent = NativeSyntheticEvent<{ layout: LayoutRectangle }>;

export interface ScrollViewMethods {
    getBoundingClientRect(): DOMRect | null | undefined;
    getCurrentScrollOffset(): number;
    getRawScrollOffset(): number;
    getMaxScrollOffset(): number;
    getScrollableNode(): HTMLElement | null;
    getScrollEventTarget(): ScrollEventTarget | null;
    getScrollResponder(): HTMLElement | null;
    isWindowScroll?(): boolean;
    getContentNode?(): HTMLElement | null;
    isScrollInRange?(): boolean;
    scrollBy(x: number, y: number): void;
    scrollTo(options: { x?: number; y?: number; animated?: boolean }): void;
    scrollToEnd(options?: { animated?: boolean }): void;
    scrollToOffset(params: { offset: number; animated?: boolean }): void;
}

export interface ListComponentScrollViewProps {
    className?: string;
    contentContainerClassName?: string;
    horizontal?: boolean;
    contentContainerStyle?: CSSProperties;
    contentOffset?: { x: number; y: number };
    maintainVisibleContentPosition?: { minIndexForVisible: number };
    onScroll?: (event: {
        nativeEvent: {
            contentOffset: { x: number; y: number };
            contentSize: { width: number; height: number };
            layoutMeasurement: { width: number; height: number };
        };
    }) => void;
    onInternalScrollEnd?: () => void;
    onMomentumScrollBegin?: (event: unknown) => void;
    onMomentumScrollEnd?: (event: {
        nativeEvent: {
            contentOffset: { x: number; y: number };
        };
    }) => void;
    snapToOffsets?: number[];
    showsHorizontalScrollIndicator?: boolean;
    showsVerticalScrollIndicator?: boolean;
    refreshControl?: ReactElement;
    children: ReactNode;
    style: CSSProperties;
    useWindowScroll?: boolean;
    scrollElement?: HTMLElement | null;
    onLayout: (event: LayoutChangeEvent) => void;
}

interface ExtraPropsFromRN {
    contentInset?: { bottom?: number; left?: number; right?: number; top?: number };
    scrollEventThrottle?: number;
    ScrollComponent?: React.ComponentType<unknown>;
}

const SCROLLBAR_HIDDEN_STYLE_ID = "legend-list-scrollbar-axis-hidden-style";
const SCROLL_END_FALLBACK_MS = 200;
// scrollbar-width covers Firefox and Chrome 121+ (which ignores ::-webkit-scrollbar once scrollbar-width or the
// inherited scrollbar-color is set); ::-webkit-scrollbar covers older WebKit. Like react-native-web's ScrollView,
// this hides the element's scrollbars on both axes, since the standard property can't target one axis.
const SCROLLBAR_HIDDEN_STYLE = `.${LEGEND_LIST_SCROLLBAR_Y_HIDDEN_CLASS},.${LEGEND_LIST_SCROLLBAR_X_HIDDEN_CLASS}{scrollbar-width:none;}.${LEGEND_LIST_SCROLLBAR_Y_HIDDEN_CLASS}::-webkit-scrollbar,.${LEGEND_LIST_SCROLLBAR_X_HIDDEN_CLASS}::-webkit-scrollbar{display:none;}`;

function ensureScrollbarHiddenStyle() {
    if (typeof document === "undefined" || document.getElementById(SCROLLBAR_HIDDEN_STYLE_ID)) {
        return;
    }

    const styleElement = document.createElement("style");
    styleElement.id = SCROLLBAR_HIDDEN_STYLE_ID;
    styleElement.textContent = SCROLLBAR_HIDDEN_STYLE;
    document.head.appendChild(styleElement);
}

function getFiniteSnapOffsets(snapToOffsets: number[] | undefined): number[] {
    if (!snapToOffsets?.length) {
        return [];
    }

    const snapOffsets: number[] = [];
    const seen = new Set<number>();
    for (const offset of snapToOffsets) {
        if (Number.isFinite(offset) && !seen.has(offset)) {
            seen.add(offset);
            snapOffsets.push(offset);
        }
    }
    return snapOffsets;
}

function getSnapAnchorStyle(offset: number, horizontal: boolean): CSSProperties {
    return {
        height: horizontal ? "100%" : 1,
        left: horizontal ? offset : 0,
        pointerEvents: "none",
        position: "absolute",
        scrollSnapAlign: "start",
        top: horizontal ? 0 : offset,
        width: horizontal ? 1 : "100%",
    };
}

// biome-ignore lint/nursery/noShadow: const function name shadowing is intentional
export const ListComponentScrollView = forwardRef(function ListComponentScrollView(
    {
        children,
        style,
        contentContainerClassName,
        contentContainerStyle,
        horizontal = false,
        contentOffset,
        maintainVisibleContentPosition,
        onScroll,
        onInternalScrollEnd,
        onMomentumScrollBegin: _onMomentumScrollBegin,
        onMomentumScrollEnd: _onMomentumScrollEnd,
        showsHorizontalScrollIndicator = true,
        showsVerticalScrollIndicator = true,
        refreshControl,
        useWindowScroll = false,
        scrollElement: externalScrollElement,
        onLayout,
        ...props
    }: ListComponentScrollViewProps,
    ref: React.Ref<HTMLDivElement>,
) {
    const ctx = useStateContext();
    const [anchoredEndSpaceSize] = useArr$(["anchoredEndSpaceSize"]);
    const scrollRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const externalTarget =
        externalScrollElement === undefined && useWindowScroll
            ? typeof window === "undefined"
                ? null
                : window
            : externalScrollElement;
    const isWindowScroll = isWindowTarget(externalTarget);
    const isExternalScroll = externalTarget !== undefined;
    const getScrollTarget = useCallback(
        () => resolveScrollEventTarget(scrollRef.current, externalTarget),
        [externalTarget],
    );

    const getMaxScrollOffset = useCallback(() => {
        const scrollElement = scrollRef.current;
        const contentSize = getScrollContentSize(scrollElement, contentRef.current, externalTarget);
        const layoutMeasurement = getLayoutMeasurement(scrollElement, externalTarget, horizontal);
        return getMaxOffset(contentSize, layoutMeasurement, horizontal);
    }, [externalTarget, horizontal]);

    const getExternalListPosition = useCallback(
        () =>
            getElementScrollPosition(
                scrollRef.current,
                externalTarget,
                horizontal && isHorizontalRTL(ctx.state) && getNativeHorizontalRTLScrollType(ctx.state) === "negative",
            ),
        [ctx, externalTarget, horizontal],
    );

    const getRawScrollOffset = useCallback(() => {
        const element = scrollRef.current;
        if (isExternalScroll) {
            const scroll = getScrollPosition(externalTarget);
            const listPos = getExternalListPosition();
            return horizontal ? scroll.x - listPos.left : scroll.y - listPos.top;
        }
        return (horizontal ? element?.scrollLeft : element?.scrollTop) ?? 0;
    }, [externalTarget, getExternalListPosition, horizontal, isExternalScroll]);

    const clampScrollOffset = useCallback(
        (offset: number) => {
            const maxOffset = getMaxScrollOffset();
            return horizontal &&
                isHorizontalRTL(ctx.state) &&
                getNativeHorizontalRTLScrollType(ctx.state) === "negative"
                ? -clampOffset(-offset, maxOffset)
                : clampOffset(offset, maxOffset);
        },
        [ctx, getMaxScrollOffset, horizontal],
    );

    const isScrollInRange = useCallback(() => {
        if (!isExternalScroll) return true;
        const offset = getRawScrollOffset();
        return Math.abs(offset - clampScrollOffset(offset)) <= 1;
    }, [clampScrollOffset, getRawScrollOffset, isExternalScroll]);

    const getCurrentScrollOffset = useCallback(() => {
        const offset = getRawScrollOffset();
        return isExternalScroll ? clampScrollOffset(offset) : offset;
    }, [clampScrollOffset, getRawScrollOffset, isExternalScroll]);

    const scrollToLocalOffset = useCallback(
        (offset: number, animated: boolean) => {
            const target = getScrollTarget();
            if (!target || typeof target.scrollTo !== "function") {
                return;
            }

            const behavior = animated ? "smooth" : "instant";
            const options: ScrollToOptions = { behavior };

            if (isExternalScroll) {
                const scroll = getScrollPosition(externalTarget);
                const listPos = getExternalListPosition();
                const { left, top } = resolveExternalScrollOffset({
                    clampedOffset: clampScrollOffset(offset),
                    horizontal,
                    listPos,
                    scroll,
                });
                options.left = left;
                options.top = top;
            } else {
                const maxOffset = getMaxScrollOffset();
                if (horizontal) {
                    // RTL scrollers with the negative scrollLeft convention take offsets in [-max, 0].
                    options.left = offset < 0 ? -clampOffset(-offset, maxOffset) : clampOffset(offset, maxOffset);
                } else {
                    options.top = clampOffset(offset, maxOffset);
                }
            }

            target.scrollTo(options);
        },
        [
            clampScrollOffset,
            externalTarget,
            getExternalListPosition,
            getMaxScrollOffset,
            getScrollTarget,
            horizontal,
            isExternalScroll,
        ],
    );

    useImperativeHandle(ref, () => {
        const api: ScrollViewMethods = {
            getBoundingClientRect: () => scrollRef.current?.getBoundingClientRect(),
            getContentNode: () => contentRef.current,
            getCurrentScrollOffset,
            getMaxScrollOffset,
            getRawScrollOffset,
            getScrollableNode: () => resolveScrollableNode(scrollRef.current, externalTarget),
            getScrollEventTarget: getScrollTarget,
            getScrollResponder: () => resolveScrollableNode(scrollRef.current, externalTarget),
            isScrollInRange,
            isWindowScroll: () => isWindowScroll,
            scrollBy: (x: number, y: number) => {
                const target = getScrollTarget();
                if (!target || typeof target.scrollBy !== "function") {
                    return;
                }
                target.scrollBy({ behavior: "auto", left: x, top: y });
            },
            scrollTo: (options: { x?: number; y?: number; animated?: boolean }) => {
                const { x = 0, y = 0, animated = true } = options;
                scrollToLocalOffset(horizontal ? x : y, animated);
            },
            scrollToEnd: (options: { animated?: boolean } = {}) => {
                const { animated = true } = options;
                const endOffset = getMaxScrollOffset();
                scrollToLocalOffset(endOffset, animated);
            },
            scrollToOffset: (params: { offset: number; animated?: boolean }) => {
                const { offset, animated = true } = params;
                scrollToLocalOffset(offset, animated);
            },
        };
        return api as unknown as HTMLDivElement & ScrollViewMethods;
    }, [
        externalTarget,
        getCurrentScrollOffset,
        getRawScrollOffset,
        getMaxScrollOffset,
        isScrollInRange,
        getScrollTarget,
        horizontal,
        isWindowScroll,
        scrollToLocalOffset,
    ]);

    // DOM scroll events can fire multiple times inside one paint. Coalesce them into a single
    // RN-shaped event per frame so downstream scroll bookkeeping sees stable measurements.
    const emitScroll = useCallback(() => {
        if (!onScroll || !scrollRef.current) {
            return;
        }

        const contentSize = getContentSize(contentRef.current);
        const layoutMeasurement = getLayoutMeasurement(scrollRef.current, externalTarget, horizontal);
        // Preserve the owner's position before/after this list for viewport calculations.
        // Imperative scroll targets still use the clamped list-local offset.
        const offset = getRawScrollOffset();

        const scrollEvent = {
            nativeEvent: {
                contentOffset: {
                    x: horizontal ? offset : 0,
                    y: horizontal ? 0 : offset,
                },
                contentSize: {
                    height: contentSize.height,
                    width: contentSize.width,
                },
                layoutMeasurement: {
                    height: layoutMeasurement.height,
                    width: layoutMeasurement.width,
                },
            },
        };

        onScroll(scrollEvent);
    }, [externalTarget, getRawScrollOffset, horizontal, onScroll]);

    const scrollEventCoalescer = useRafCoalescer(emitScroll);
    const scrollEndFallbackRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    const emitScrollEnd = useCallback(() => {
        const timeout = scrollEndFallbackRef.current;
        if (timeout !== undefined) {
            clearTimeout(timeout);
            scrollEndFallbackRef.current = undefined;
        }
        scrollEventCoalescer.flush();
        onInternalScrollEnd?.();
    }, [onInternalScrollEnd, scrollEventCoalescer]);

    const handleScroll = useCallback(
        (_event: Event) => {
            if (!onScroll) {
                return;
            }

            const state = ctx.state;
            if (
                !hasActiveInitialScroll(state) &&
                !state.scrollingTo &&
                (state.maintainingScrollAtEnd || state.pendingMaintainScrollAtEnd)
            ) {
                const maxOffset = getMaxScrollOffset();
                if (
                    peekLogicalHorizontalOffset(state, getCurrentScrollOffset(), maxOffset) <
                    clampOffset(state.scroll, maxOffset) - 1
                ) {
                    interruptUserScroll(ctx);
                }
            }
            const shouldFlushImmediately =
                !!state.scrollingTo ||
                (!state.didFinishInitialScroll && !!(state.initialScrollSession || state.initialScroll)) ||
                isInMVCPActiveMode(state);
            if (shouldFlushImmediately) {
                scrollEventCoalescer.flush();
            } else {
                scrollEventCoalescer.schedule();
            }

            if (onInternalScrollEnd) {
                const timeout = scrollEndFallbackRef.current;
                if (timeout !== undefined) {
                    clearTimeout(timeout);
                }
                scrollEndFallbackRef.current = setTimeout(emitScrollEnd, SCROLL_END_FALLBACK_MS);
            }
        },
        [
            ctx,
            emitScrollEnd,
            getCurrentScrollOffset,
            getMaxScrollOffset,
            onInternalScrollEnd,
            onScroll,
            scrollEventCoalescer,
        ],
    );

    useLayoutEffect(() => {
        const target = getScrollTarget();
        if (!target) return;
        target.addEventListener("scroll", handleScroll, { passive: true });
        if ("onscrollend" in target) target.addEventListener("scrollend", emitScrollEnd);
        return () => {
            target.removeEventListener("scroll", handleScroll);
            target.removeEventListener("scrollend", emitScrollEnd);
            const timeout = scrollEndFallbackRef.current;
            if (timeout !== undefined) {
                clearTimeout(timeout);
                scrollEndFallbackRef.current = undefined;
            }
            scrollEventCoalescer.cancel();
        };
    }, [emitScrollEnd, getScrollTarget, handleScroll, scrollEventCoalescer]);

    useEffect(() => {
        const target = getScrollTarget();
        if (!target) return;
        const isExplicitNavigation = () => {
            const state = ctx.state;
            const initial = state.initialScroll;
            if (hasActiveInitialScroll(state)) {
                return !(initial?.viewPosition === 1 && initial.index === state.props.data.length - 1);
            }
            return !!(
                (state.scrollingTo &&
                    !state.scrollingTo.isInitialScroll &&
                    (!state.scrollingTo.isScrollToEnd ||
                        (state.pendingScrollResolve && !state.maintainingScrollAtEnd))) ||
                (state.endFollowInterrupted && state.pendingScrollResolve)
            );
        };
        const acceptInput = (
            event: Event,
            direction: number,
            isNew = true,
            keepsExplicitOwner = false,
            isWheel = false,
        ) => {
            const state = ctx.state;
            if (
                !state.props.onUserScroll &&
                !state.props.maintainScrollAtEnd &&
                !state.maintainingScrollAtEnd &&
                !state.pendingMaintainScrollAtEnd &&
                !state.scrollingTo &&
                !state.pendingScrollResolve &&
                !hasActiveInitialScroll(state)
            ) {
                return false;
            }
            const explicit = isExplicitNavigation();
            if (direction > 0 && !explicit && !(isNew && state.props.onUserScroll)) return false;
            const node = resolveScrollableNode(scrollRef.current, externalTarget);
            const maxOffset = getMaxScrollOffset();
            const offset = peekLogicalHorizontalOffset(state, getCurrentScrollOffset(), maxOffset);
            if (
                !event.defaultPrevented &&
                node &&
                maxOffset > 1 &&
                (explicit || direction === 0 || (direction > 0 ? offset < maxOffset - 1 : offset > 1)) &&
                isScrollInRange()
            ) {
                if (!ownsScrollInput(event.target, node, horizontal, inputDirection(direction))) {
                    if (isWheel && !wheelAccepted) wheelStartedNested = true;
                    return false;
                }
                // A wheel tail that predates a command keeps its gesture owner.
                // Browsers disagree on whether a wheel that interrupts a smooth scroll still applies natively
                // (Chromium drops it, WebKit and Firefox apply it), so the stop write applies it and the native
                // scroll is cancelled. A non-cancelable wheel still applies natively, so stop at the observed
                // offset without adding its delta again.
                if (
                    (explicit ? !keepsExplicitOwner : direction <= 0) &&
                    interruptUserScroll(ctx, isWheel && event.cancelable ? direction : 0) &&
                    event.cancelable
                )
                    event.preventDefault();
                if (isNew) state.props.onUserScroll?.();
                return true;
            }
            return false;
        };
        let wheelGesture: WheelGesture | undefined;
        let wheelAccepted = false;
        let wheelStartedNested = false;
        const inputDirection = (delta: number) =>
            isHorizontalRTL(ctx.state) && getNativeHorizontalRTLScrollType(ctx.state) !== "normal" ? -delta : delta;
        const onWheel = (nativeEvent: Event) => {
            const event = nativeEvent as WheelEvent;
            const delta = normalizeWheelDelta(
                horizontal ? event.deltaX || (event.shiftKey ? event.deltaY : 0) : event.deltaY,
                event.deltaMode,
                ctx.state.scrollLength,
            );
            if (delta !== 0 && !event.ctrlKey && !event.defaultPrevented) {
                wheelGesture = getWheelGesture(
                    wheelGesture,
                    delta,
                    event.timeStamp,
                    (event as WheelEvent & { momentum?: boolean }).momentum,
                );
                if (wheelGesture.isNew) {
                    wheelAccepted = false;
                    wheelStartedNested = false;
                }
                wheelAccepted =
                    acceptInput(
                        event,
                        inputDirection(delta),
                        !wheelAccepted,
                        !wheelGesture.isNew && (!wheelStartedNested || wheelAccepted),
                        true,
                    ) || wheelAccepted;
            }
        };
        let lastTouch: number | undefined;
        let touchAccepted = false;
        const onTouchStart = (nativeEvent: Event) => {
            const touch = (nativeEvent as TouchEvent).touches[0];
            lastTouch = touch ? (horizontal ? touch.clientX : touch.clientY) : undefined;
            touchAccepted = false;
            if (lastTouch !== undefined && isExplicitNavigation()) acceptInput(nativeEvent, 0, false);
        };
        const onTouchMove = (nativeEvent: Event) => {
            const touch = (nativeEvent as TouchEvent).touches[0];
            if (!touch) return;
            const position = horizontal ? touch.clientX : touch.clientY;
            if (lastTouch !== undefined && position !== lastTouch)
                touchAccepted =
                    acceptInput(nativeEvent, inputDirection(lastTouch - position), !touchAccepted) || touchAccepted;
            lastTouch = position;
        };
        const onKeyDown = (nativeEvent: Event) => {
            const event = nativeEvent as KeyboardEvent;
            const element = event.target as HTMLElement | null;
            if (
                event.repeat ||
                event.defaultPrevented ||
                element?.isContentEditable ||
                element?.closest?.(
                    "input, textarea, select, button, a, summary, [role=button], [role=checkbox], [role=radio], [role=menu], [role=menuitem], [role=listbox], [role=combobox], [role=slider], [role=tab], [role=tree]",
                )
            )
                return;
            // Page, Home/End and Space keys scroll the block axis, which a horizontal list does not own.
            // Alt/Cmd+Left/Right navigate history instead of scrolling.
            if (horizontal) {
                if ((event.key === "ArrowLeft" || event.key === "ArrowRight") && !event.altKey && !event.metaKey)
                    acceptInput(event, inputDirection(event.key === "ArrowLeft" ? -1 : 1));
            } else if (
                event.key === "ArrowUp" ||
                event.key === "PageUp" ||
                event.key === "Home" ||
                (event.key === " " && event.shiftKey)
            )
                acceptInput(event, -1);
            else if (event.key === "ArrowDown" || event.key === "PageDown" || event.key === "End" || event.key === " ")
                acceptInput(event, 1);
        };
        let scrollbarPressOffset: number | undefined;
        const onPointerDown = (nativeEvent: Event) => {
            scrollbarPressOffset = undefined;
            const event = nativeEvent as PointerEvent;
            const element = resolveScrollableNode(scrollRef.current, externalTarget);
            if (event.target !== element || !element || event.pointerType === "touch") return;
            const rect = element.getBoundingClientRect();
            const border = getComputedStyle(element);
            const inGutter = horizontal
                ? event.clientY >= rect.top + element.clientTop + element.clientHeight &&
                  event.clientY < rect.top + element.offsetHeight - (Number.parseFloat(border.borderBottomWidth) || 0)
                : (event.clientX >= rect.left + (Number.parseFloat(border.borderLeftWidth) || 0) &&
                      event.clientX < rect.left + element.clientLeft) ||
                  (event.clientX >= rect.left + element.clientLeft + element.clientWidth &&
                      event.clientX <
                          rect.left + element.offsetWidth - (Number.parseFloat(border.borderRightWidth) || 0));
            if (inGutter) {
                const explicit = isExplicitNavigation();
                const offset = getCurrentScrollOffset();
                if (acceptInput(event, 0) && !explicit) scrollbarPressOffset = offset;
            }
        };
        const onPointerRelease = () => {
            const offset = scrollbarPressOffset;
            scrollbarPressOffset = undefined;
            if (offset !== undefined && getCurrentScrollOffset() === offset) rearmEndFollowIfSettled(ctx);
        };
        // Only an active scroll can need preventDefault, so idle wheel scrolling stays passive.
        let wheelPassive: boolean | undefined;
        const setWheelPassive = (passive: boolean) => {
            if (passive === wheelPassive) return;
            if (wheelPassive !== undefined) target.removeEventListener("wheel", onWheel);
            target.addEventListener("wheel", onWheel, { passive });
            wheelPassive = passive;
        };
        setWheelPassive(!peek$(ctx, "isScrollActive"));
        const unlistenScrollActive = listen$(ctx, "isScrollActive", (active) => setWheelPassive(!active));
        target.addEventListener("touchstart", onTouchStart, { passive: true });
        target.addEventListener("touchmove", onTouchMove, { passive: true });
        target.addEventListener("keydown", onKeyDown);
        target.addEventListener("pointerdown", onPointerDown);
        target.addEventListener("pointerup", onPointerRelease);
        target.addEventListener("pointercancel", onPointerRelease);
        return () => {
            unlistenScrollActive();
            target.removeEventListener("wheel", onWheel);
            target.removeEventListener("touchstart", onTouchStart);
            target.removeEventListener("touchmove", onTouchMove);
            target.removeEventListener("keydown", onKeyDown);
            target.removeEventListener("pointerdown", onPointerDown);
            target.removeEventListener("pointerup", onPointerRelease);
            target.removeEventListener("pointercancel", onPointerRelease);
        };
    }, [ctx, externalTarget, getCurrentScrollOffset, getMaxScrollOffset, getScrollTarget, horizontal, isScrollInRange]);

    // Set initial scroll offset
    useEffect(() => {
        const doScroll = () => {
            if (contentOffset) {
                scrollToLocalOffset(horizontal ? contentOffset.x || 0 : contentOffset.y || 0, false);
            }
        };
        doScroll();
        const frame = requestAnimationFrame(doScroll);
        return () => cancelAnimationFrame(frame);
    }, [contentOffset?.x, contentOffset?.y, horizontal, scrollToLocalOffset]);

    // The adapter owns layout in both external modes; the list itself is unbounded.
    useLayoutEffect(() => {
        const element = scrollRef.current;
        if (!onLayout || !element) return;
        return observeScrollLayout(element, externalTarget, () => {
            if (isExternalScroll && !ctx.state.lastLayout && !ctx.state.initialScroll) {
                // Seed the first range before layout allocates rows. The list may begin
                // below a header, or entirely outside the owner's viewport.
                ctx.state.scroll = ctx.state.scrollPending = getRawScrollOffset();
            }
            onLayout({ nativeEvent: { layout: getLayoutRectangle(element, externalTarget, horizontal) } });
            if (isExternalScroll) emitScroll();
        });
    }, [ctx, emitScroll, externalTarget, getRawScrollOffset, horizontal, isExternalScroll, onLayout]);

    const hiddenScrollIndicatorClassName =
        !isExternalScroll &&
        (horizontal
            ? !showsHorizontalScrollIndicator && LEGEND_LIST_SCROLLBAR_X_HIDDEN_CLASS
            : !showsVerticalScrollIndicator && LEGEND_LIST_SCROLLBAR_Y_HIDDEN_CLASS);

    useLayoutEffect(() => {
        if (hiddenScrollIndicatorClassName) {
            ensureScrollbarHiddenStyle();
        }
    }, [hiddenScrollIndicatorClassName]);

    const scrollViewStyle: CSSProperties = {
        ...(isExternalScroll
            ? {}
            : {
                  overflow: "auto",
                  overflowX: horizontal ? "auto" : showsHorizontalScrollIndicator ? "auto" : "hidden",
                  overflowY: horizontal ? (showsVerticalScrollIndicator ? "auto" : "hidden") : "auto",
                  WebkitOverflowScrolling: "touch", // iOS momentum scrolling
              }),
        ...StyleSheet.flatten(style),
        ...(maintainVisibleContentPosition
            ? {
                  // Chrome's native scroll anchoring can apply after LegendList's MVCP adjustment,
                  // causing the same header/item-size delta to be compensated twice.
                  overflowAnchor: "none",
              }
            : {}),
    };

    const contentInsetEndAdjustment = Math.max(0, ctx.state.props.contentInsetEndAdjustment ?? 0);
    const anchoredEndInset = ctx.state.props.anchoredEndSpace && anchoredEndSpaceSize ? anchoredEndSpaceSize : 0;
    const renderedContentInsetEndAdjustment = Math.max(0, contentInsetEndAdjustment - anchoredEndInset);
    const contentInsetEndAdjustmentSpacerStyle: CSSProperties | undefined = renderedContentInsetEndAdjustment
        ? horizontal
            ? { flexShrink: 0, width: renderedContentInsetEndAdjustment }
            : { height: renderedContentInsetEndAdjustment }
        : undefined;
    const contentStyle: CSSProperties = {
        display: horizontal ? "flex" : "block",
        flexDirection: horizontal ? "row" : undefined,
        minHeight: horizontal ? undefined : "100%",
        minWidth: horizontal ? "100%" : undefined,
        ...StyleSheet.flatten(contentContainerStyle),
        ...(maintainVisibleContentPosition
            ? {
                  overflowAnchor: "none",
              }
            : {}),
    };
    const className = contentContainerClassName
        ? `${LEGEND_LIST_CONTENT_CONTAINER_CLASS} ${contentContainerClassName}`
        : LEGEND_LIST_CONTENT_CONTAINER_CLASS;

    const {
        contentContainerClassName: _contentContainerClassName,
        contentInset: _contentInset,
        scrollEventThrottle: _scrollEventThrottle,
        ScrollComponent: _ScrollComponent,
        snapToOffsets,
        className: scrollViewClassNameProp,
        ...webProps
    } = props as ListComponentScrollViewProps & ExtraPropsFromRN & HTMLAttributes<HTMLDivElement>;
    const snapOffsets = !isExternalScroll ? getFiniteSnapOffsets(snapToOffsets) : [];
    if (snapOffsets.length > 0) {
        scrollViewStyle.scrollSnapType = horizontal ? "x mandatory" : "y mandatory";
        contentStyle.position = contentStyle.position ?? "relative";
    }
    const scrollViewClassName = hiddenScrollIndicatorClassName
        ? scrollViewClassNameProp
            ? `${scrollViewClassNameProp} ${hiddenScrollIndicatorClassName}`
            : hiddenScrollIndicatorClassName
        : scrollViewClassNameProp;

    if (IS_DEV) {
        if (
            /(?:^|\s)(?:[a-z0-9_-]+:)*gap(?:-[xy])?-(?:\[[^\]]+\]|[^\s]+)/.test(
                `${contentContainerClassName ?? ""} ${scrollViewClassNameProp ?? ""}`,
            )
        ) {
            warnDevOnce(
                "className-gap",
                "className/contentContainerClassName gap classes are not supported in LegendList because it needs to use exact values internally. Use contentContainerStyle={{ gap: ... }} or columnWrapperStyle instead.",
            );
        }
    }

    return (
        <div
            className={scrollViewClassName}
            ref={scrollRef}
            {...(webProps as HTMLAttributes<HTMLDivElement>)}
            style={scrollViewStyle}
        >
            {refreshControl}
            <div className={className} ref={contentRef} style={contentStyle}>
                {snapOffsets.map((offset) => (
                    <div
                        aria-hidden={true}
                        data-legend-list-snap-anchor={offset}
                        key={`snap-${offset}`}
                        style={getSnapAnchorStyle(offset, horizontal)}
                    />
                ))}
                {children}
                {contentInsetEndAdjustmentSpacerStyle ? (
                    <div aria-hidden={true} style={contentInsetEndAdjustmentSpacerStyle} />
                ) : null}
            </div>
        </div>
    );
});
