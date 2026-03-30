import type { InternalState, ScrollIndexWithOffsetAndContentOffset } from "@/types.base";

const INITIAL_SCROLL_RETRY_WINDOW_MS = 600;

type InitialScrollRetryState = Pick<
    InternalState,
    | "didFinishInitialScroll"
    | "initialScrollLastDidFinish"
    | "initialScrollLastTarget"
    | "initialScrollLastTargetUsesOffset"
    | "initialScrollRetryLastLength"
    | "initialScrollRetryWindowUntil"
    | "scrollLength"
>;

type InitialScrollEmptyRearmState = Pick<InternalState, "didFinishInitialScroll" | "initialScrollUsesOffset">;

export function resolveInitialScrollTarget(options: {
    dataLength: number;
    initialScrollAtEnd: boolean;
    initialScrollIndex:
        | number
        | {
              index: number;
              viewOffset?: number | undefined;
              viewPosition?: number | undefined;
          }
        | undefined;
    initialScrollOffset: number | undefined;
    stylePaddingBottom: number;
}): {
    initialScroll: ScrollIndexWithOffsetAndContentOffset | undefined;
    initialScrollUsesOffsetOnly: boolean;
} {
    const { dataLength, initialScrollAtEnd, initialScrollIndex, initialScrollOffset, stylePaddingBottom } = options;
    const hasInitialScrollIndex = initialScrollIndex !== undefined && initialScrollIndex !== null;
    const hasInitialScrollOffset = initialScrollOffset !== undefined && initialScrollOffset !== null;
    const initialScrollUsesOffsetOnly = !initialScrollAtEnd && !hasInitialScrollIndex && hasInitialScrollOffset;
    const shouldDefaultObjectInitialScrollToEnd = !!(
        hasInitialScrollIndex &&
        typeof initialScrollIndex === "object" &&
        initialScrollIndex.viewPosition === undefined &&
        initialScrollIndex.viewOffset === undefined &&
        initialScrollIndex.index === dataLength - 1
    );

    const initialScroll = initialScrollAtEnd
        ? { index: Math.max(0, dataLength - 1), viewOffset: -stylePaddingBottom, viewPosition: 1 }
        : hasInitialScrollIndex
          ? typeof initialScrollIndex === "object"
              ? {
                    index: initialScrollIndex.index ?? 0,
                    viewOffset:
                        initialScrollIndex.viewOffset ??
                        (initialScrollIndex.viewPosition === 1 || shouldDefaultObjectInitialScrollToEnd
                            ? -stylePaddingBottom
                            : 0),
                    viewPosition: initialScrollIndex.viewPosition ?? (shouldDefaultObjectInitialScrollToEnd ? 1 : 0),
                }
              : {
                    index: initialScrollIndex ?? 0,
                    viewOffset:
                        initialScrollOffset ?? (initialScrollIndex === dataLength - 1 ? -stylePaddingBottom : 0),
                    viewPosition: initialScrollIndex === dataLength - 1 ? 1 : 0,
                }
          : initialScrollUsesOffsetOnly
            ? {
                  contentOffset: initialScrollOffset ?? 0,
                  index: 0,
                  viewOffset: 0,
              }
            : undefined;

    return {
        initialScroll,
        initialScrollUsesOffsetOnly,
    };
}

export function createEndAlignedInitialScrollTarget(options: {
    dataLength: number;
    initialScroll?: ScrollIndexWithOffsetAndContentOffset;
    stylePaddingBottom: number;
    viewOffset?: number;
}): ScrollIndexWithOffsetAndContentOffset {
    const lastIndex = Math.max(0, options.dataLength - 1);
    return {
        contentOffset: undefined,
        index: lastIndex,
        viewOffset: options.viewOffset ?? options.initialScroll?.viewOffset ?? -options.stylePaddingBottom,
        viewPosition: 1,
    };
}

export function shouldKeepEndAlignedInitialScrollTarget(options: {
    dataLength: number;
    initialScroll: ScrollIndexWithOffsetAndContentOffset | undefined;
    initialScrollUsesOffset: boolean;
    shouldRearm: boolean;
}): boolean {
    const lastIndex = Math.max(0, options.dataLength - 1);
    const { initialScroll } = options;
    return !!(
        initialScroll &&
        !options.initialScrollUsesOffset &&
        initialScroll.index === lastIndex &&
        initialScroll.viewPosition === 1 &&
        !options.shouldRearm
    );
}

export function shouldFinishInitialScrollAtOrigin(options: {
    initialScroll: ScrollIndexWithOffsetAndContentOffset;
    initialScrollAtEnd: boolean;
    initialScrollUsesOffset: boolean;
    offset: number;
}): boolean {
    const { initialScroll, initialScrollAtEnd, initialScrollUsesOffset, offset } = options;
    if (offset !== 0 || initialScrollAtEnd) {
        return false;
    }

    if (initialScrollUsesOffset) {
        return Math.abs(initialScroll.contentOffset ?? 0) <= 1;
    }

    return (
        initialScroll.index === 0 &&
        (initialScroll.viewPosition ?? 0) === 0 &&
        Math.abs(initialScroll.viewOffset ?? 0) <= 1
    );
}

export function shouldFinishEmptyInitialScrollAtEnd(options: {
    dataLength: number;
    initialScrollAtEnd: boolean;
    initialScroll: ScrollIndexWithOffsetAndContentOffset;
    offset: number;
}): boolean {
    return (
        options.dataLength === 0 &&
        options.initialScrollAtEnd &&
        options.offset === 0 &&
        options.initialScroll.viewPosition === 1
    );
}

export function shouldRearmFinishedEmptyInitialScrollAtEnd(options: {
    dataLength: number;
    initialScroll: ScrollIndexWithOffsetAndContentOffset | undefined;
    state: InitialScrollEmptyRearmState;
}): boolean {
    const { initialScroll, state } = options;
    return !!(
        state.didFinishInitialScroll &&
        options.dataLength > 0 &&
        initialScroll &&
        !state.initialScrollUsesOffset &&
        initialScroll.index === 0 &&
        initialScroll.viewPosition === 1 &&
        (initialScroll.contentOffset ?? 0) === 0
    );
}

export function trackInitialScrollRetryWindow(
    state: InitialScrollRetryState,
    now: number,
): {
    didScrollLengthChange: boolean;
} {
    const didFinishInitialScroll = !!state.didFinishInitialScroll;
    if (didFinishInitialScroll && !state.initialScrollLastDidFinish) {
        state.initialScrollRetryWindowUntil = now + INITIAL_SCROLL_RETRY_WINDOW_MS;
    }
    state.initialScrollLastDidFinish = didFinishInitialScroll;

    const previousScrollLength = state.initialScrollRetryLastLength;
    const currentScrollLength = state.scrollLength;
    const didScrollLengthChange =
        previousScrollLength === undefined || Math.abs(currentScrollLength - previousScrollLength) > 1;

    if (didScrollLengthChange) {
        state.initialScrollRetryLastLength = currentScrollLength;
    }

    return { didScrollLengthChange };
}

export function shouldRetryFinishedInitialScrollAfterLayoutChange(
    state: InitialScrollRetryState,
    now: number,
    didScrollLengthChange: boolean,
): boolean {
    return !!(
        state.didFinishInitialScroll &&
        didScrollLengthChange &&
        now <= state.initialScrollRetryWindowUntil &&
        !state.initialScrollLastTargetUsesOffset &&
        state.initialScrollLastTarget?.index !== undefined
    );
}
