// Dev/test-only layout invariants for LegendList. The list exposes its internal context to
// globalThis.__LEGEND_LIST_DEV_HOOK__ in dev builds (see src/components/useDevChecks.ts); nothing
// here ships in the library. Shared by the unit-test harness, the fuzzer and the example apps.

import { getContentSize } from "@/state/getContentSize";

const POSITION_OUT_OF_VIEW = -10000000;

// Structural view of the internal StateContext, so this file does not depend on src types.
export type ListCtx = {
    scrollAxisGap: number;
    state: any;
    values: Map<string, any>;
    viewRefs: Map<number, { current: any }>;
};

export type LayoutViolation =
    | { kind: "firstPosition"; position: number }
    | { kind: "position"; index: number; expected: number; actual: number }
    | { kind: "totalSize"; expected: number; actual: number }
    | { kind: "containerPosition"; containerId: number; index: number; expected: number; actual: number }
    | { kind: "blank"; source: "state" | "dom"; start: number; end: number; size: number; viewport: [number, number] }
    | { kind: "overflow"; index: number; start: number; end: number; size: number };

type Interval = [number, number];

const DEFAULT_TOLERANCE = 1;

function sizeOf(state: any, key: string | undefined) {
    return key === undefined ? undefined : (state.sizesKnown.get(key) ?? state.sizes.get(key));
}

function startOffset(ctx: ListCtx) {
    const { state, values } = ctx;
    const padding = state.props.horizontal ? state.props.stylePaddingLeft || 0 : values.get("stylePaddingTop") || 0;
    return padding + (values.get("alignItemsAtEndPadding") || 0) + (values.get("headerSize") || 0);
}

function isCheckable(ctx: ListCtx) {
    const { state, values } = ctx;
    return (
        !state.isUnmounted &&
        !!values.get("readyToRender") &&
        state.scrollLength > 0 &&
        state.props.data.length > 0 &&
        state.idCache.length >= state.props.data.length
    );
}

/** Uncovered spans of `region`, given covering intervals (merged in place). */
function findGaps(intervals: Interval[], region: Interval, tolerance: number): Interval[] {
    intervals.sort((a, b) => a[0] - b[0]);
    const gaps: Interval[] = [];
    let cursor = region[0];
    for (const [start, end] of intervals) {
        if (start - cursor > tolerance && cursor < region[1]) {
            gaps.push([cursor, Math.min(start, region[1])]);
        }
        cursor = Math.max(cursor, end);
        if (cursor >= region[1]) break;
    }
    if (region[1] - cursor > tolerance) {
        gaps.push([cursor, region[1]]);
    }
    return gaps.filter(([start, end]) => end - start > tolerance);
}

/** The visible item-space window: the scroll offset clamped to the scrollable extent, as a scroll view does. */
export function getVisibleItemRange(ctx: ListCtx, scrollOffset: number = ctx.state.scroll): Interval {
    const { state, values } = ctx;
    const maxOffset = Math.max(0, getContentSize(ctx as any) - state.scrollLength);
    const offset = state.props.hasExternalScroll ? scrollOffset : Math.min(scrollOffset, maxOffset);
    const start = offset + (values.get("scrollAdjustPending") ?? 0) - startOffset(ctx);
    return [Math.max(0, start), Math.min(start + state.scrollLength, state.totalSize)];
}

/** Rendered containers as [index, itemSpaceStart, size, containerId]. */
export function getRenderedContainers(ctx: ListCtx) {
    const { state, values } = ctx;
    const rendered: Array<[number, number, number, number]> = [];
    // Containers are placed at their item position minus the pending scroll adjustment.
    const pending = values.get("scrollAdjustPending") ?? 0;
    const numContainers = values.get("numContainers") ?? 0;
    for (let id = 0; id < numContainers; id++) {
        const key = values.get(`containerItemKey${id}`);
        const position = values.get(`containerPosition${id}`);
        const index = key === undefined ? undefined : state.indexByKey.get(key);
        const size = sizeOf(state, key);
        if (index === undefined || size === undefined || position === undefined || position === POSITION_OUT_OF_VIEW) {
            continue;
        }
        if (state.props.hideItemsUntilMeasured && values.get(`containerLayoutReady${id}`) === false) {
            continue;
        }
        rendered.push([index, position + pending, size, id]);
    }
    return rendered;
}

/** One-line summary of the state the invariants read, for failure messages. */
export function describeListState(ctx: ListCtx) {
    const { state } = ctx;
    const rendered = getRenderedContainers(ctx)
        .sort((a, b) => a[0] - b[0])
        .map(([index, position, size]) => `${index}@${position}+${size}`);
    const target = state.scrollingTo;
    return [
        `scroll ${state.scroll}`,
        `scrollLength ${state.scrollLength}`,
        `totalSize ${state.totalSize}`,
        `data ${state.props.data.length}`,
        `buffered ${state.startBuffered}-${state.endBuffered}`,
        `bootstrap ${state.initialScrollSession?.bootstrap ? "active" : "none"}`,
        `scrollingTo ${target ? `${target.index ?? ""}@${target.offset}${target.animated ? " animated" : ""}` : "none"}`,
        `rendered ${rendered.join(" ")}`,
    ].join(", ");
}

export interface CheckLayoutOptions {
    /** Only check visible coverage, for frames where positions may lag by one pass. */
    blankOnly?: boolean;
    /** Also require each rendered container to sit at its item's computed position. */
    containerPositions?: boolean;
    /** The scroll view's actual offset, when known (defaults to the list's last observed scroll). */
    scrollOffset?: number;
    tolerance?: number;
}

/**
 * Checks the list's own layout state: positions are contiguous from 0 through the rendered items,
 * totalSize is the sum of item sizes, and the visible window is covered by rendered containers.
 */
export function checkLayoutInvariants(ctx: ListCtx, options: CheckLayoutOptions = {}): LayoutViolation[] {
    if (!isCheckable(ctx)) return [];
    const { state, values } = ctx;
    const tolerance = options.tolerance ?? DEFAULT_TOLERANCE;
    const violations: LayoutViolation[] = [];
    const { idCache, positions } = state;
    const dataLength = state.props.data.length;
    const numColumns = values.get("numColumns") ?? 1;
    const rendered = getRenderedContainers(ctx);

    if (numColumns === 1 && !options.blankOnly) {
        // Positions past the rendered items may lag by design (early-break position passes).
        let lastRenderedIndex = -1;
        for (const [index] of rendered) lastRenderedIndex = Math.max(lastRenderedIndex, index);
        if (positions[0] !== undefined && Math.abs(positions[0]) > tolerance) {
            violations.push({ kind: "firstPosition", position: positions[0] });
        }
        let sum = 0;
        let sumKnown = true;
        let reportedPosition = false;
        for (let i = 0; i < dataLength; i++) {
            const size = sizeOf(state, idCache[i]);
            if (i <= lastRenderedIndex && i > 0 && sumKnown && !reportedPosition) {
                const actual = positions[i];
                if (actual !== undefined && Math.abs(actual - sum) > tolerance) {
                    violations.push({ actual, expected: sum, index: i, kind: "position" });
                    reportedPosition = true;
                }
            }
            if (size === undefined) {
                sumKnown = false;
            } else {
                sum += size;
            }
        }
        const totalSize = state.pendingTotalSize ?? state.totalSize;
        if (sumKnown && Math.abs(totalSize - sum) > tolerance) {
            violations.push({ actual: totalSize, expected: sum, kind: "totalSize" });
        }
    }

    // Horizontal RTL containers use mirrored physical positions; only the position checks apply.
    if (state.props.horizontal && state.props.rtl) return violations;

    if (options.containerPositions && !options.blankOnly) {
        for (const [index, position, , containerId] of rendered) {
            const expected = positions[index];
            const isSticky = values.get(`containerSticky${containerId}`);
            if (!isSticky && expected !== undefined && Math.abs(expected - position) > tolerance) {
                violations.push({ actual: position, containerId, expected, index, kind: "containerPosition" });
            }
        }
    }

    const viewport = getVisibleItemRange(ctx, options.scrollOffset);
    if (viewport[1] - viewport[0] > tolerance) {
        const intervals = rendered.map(([, position, size]): Interval => [position, position + size]);
        for (const [start, end] of findGaps(intervals, viewport, tolerance + (ctx.scrollAxisGap || 0))) {
            violations.push({ end, kind: "blank", size: end - start, source: "state", start, viewport });
        }
    }

    return violations;
}

function findScroller(element: HTMLElement): HTMLElement | null {
    for (let node = element.parentElement; node; node = node.parentElement) {
        const style = getComputedStyle(node);
        if (/(auto|scroll)/.test(style.overflowY + style.overflowX)) return node;
    }
    return null;
}

/**
 * Web only: checks the painted DOM. The part of the containers' parent that is inside the scroller's
 * visible rect must be covered by the bounding rects of rendered container elements, and no visible
 * row may paint outside that parent (rows displaced past the content end, e.g. over a footer).
 */
export function checkDomCoverage(ctx: ListCtx, tolerance = DEFAULT_TOLERANCE): LayoutViolation[] {
    if (typeof document === "undefined" || !isCheckable(ctx)) return [];
    const { state, values } = ctx;
    const horizontal = !!state.props.horizontal;
    const rows: Array<[number, number, number]> = [];
    let parent: HTMLElement | null = null;
    const numContainers = values.get("numContainers") ?? 0;
    for (let id = 0; id < numContainers; id++) {
        const element = ctx.viewRefs.get(id)?.current as HTMLElement | null | undefined;
        const key = values.get(`containerItemKey${id}`);
        const index = key === undefined ? undefined : state.indexByKey.get(key);
        if (!element?.getBoundingClientRect || index === undefined) continue;
        parent ??= element.parentElement;
        if (element.style.opacity === "0" || values.get(`containerSticky${id}`)) continue;
        const rect = element.getBoundingClientRect();
        rows.push(horizontal ? [index, rect.left, rect.right] : [index, rect.top, rect.bottom]);
    }
    if (!parent || parent.style.opacity === "0") return [];
    const scroller = findScroller(parent);
    const content = parent.getBoundingClientRect();
    // The scroller's client box: its borders and scrollbars are not viewport.
    const outer = scroller?.getBoundingClientRect();
    const view =
        scroller && outer
            ? {
                  bottom: outer.top + scroller.clientTop + scroller.clientHeight,
                  left: outer.left + scroller.clientLeft,
                  right: outer.left + scroller.clientLeft + scroller.clientWidth,
                  top: outer.top + scroller.clientTop,
              }
            : { bottom: innerHeight, left: 0, right: innerWidth, top: 0 };
    const [viewStart, viewEnd] = horizontal
        ? [Math.max(view.left, 0), Math.min(view.right, innerWidth)]
        : [Math.max(view.top, 0), Math.min(view.bottom, innerHeight)];
    const [contentStart, contentEnd] = horizontal ? [content.left, content.right] : [content.top, content.bottom];
    const region: Interval = [Math.max(contentStart, viewStart), Math.min(contentEnd, viewEnd)];
    const violations: LayoutViolation[] = [];
    for (const [index, start, end] of rows) {
        const before = Math.min(end, contentStart, viewEnd) - Math.max(start, viewStart);
        const after = Math.min(end, viewEnd) - Math.max(start, contentEnd, viewStart);
        const size = Math.max(before, after);
        if (size > tolerance) {
            violations.push({ end: end - contentStart, index, kind: "overflow", size, start: start - contentStart });
        }
    }
    if (region[1] - region[0] <= tolerance) return violations;
    const intervals = rows.map(([, start, end]): Interval => [start, end]);
    for (const [start, end] of findGaps(intervals, region, tolerance + (ctx.scrollAxisGap || 0))) {
        violations.push({
            end: end - contentStart,
            kind: "blank",
            size: end - start,
            source: "dom",
            start: start - contentStart,
            viewport: [region[0] - contentStart, region[1] - contentStart],
        });
    }
    return violations;
}

type DevHook = (ctx: ListCtx) => (() => void) | undefined;
type DevGlobal = typeof globalThis & { __LEGEND_LIST_DEV_HOOK__?: DevHook };

/** Registers a callback for every LegendList that mounts in a dev build; returns an uninstaller. */
export function installListRegistry(lists: Set<ListCtx>) {
    const g = globalThis as DevGlobal;
    const previous = g.__LEGEND_LIST_DEV_HOOK__;
    g.__LEGEND_LIST_DEV_HOOK__ = (ctx) => {
        lists.add(ctx);
        const previousCleanup = previous?.(ctx);
        return () => {
            lists.delete(ctx);
            previousCleanup?.();
        };
    };
    return () => {
        g.__LEGEND_LIST_DEV_HOOK__ = previous;
    };
}

export interface FrameViolation {
    frame: number;
    list: number;
    /** "frame": the state a frame painted. "task": the state after a DOM-mutating task (strict mode). */
    phase: "frame" | "task";
    scroll: number;
    time: number;
    totalSize: number;
    violations: LayoutViolation[];
}

export interface LayoutMonitor {
    frames: number;
    log: FrameViolation[];
    reset(): void;
    stop(): void;
    /** Frame counts and largest size per violation kind ("blank" counts state and DOM sources). */
    summary(): { frames: number; violationFrames: number; kinds: Record<string, { frames: number; max: number }> };
}

/**
 * Samples every mounted list once per frame and records frames that break an invariant.
 * On web the sample runs in a ResizeObserver created during the frame's rAF, so it is delivered
 * after the list's own rAF and ResizeObserver work, right before paint: it sees what the frame
 * paints. A task posted after paint would also see intermediate states from tasks (timers, React
 * scheduler) that run before the next frame corrects them. Native samples after the JS frame.
 * `strict` (web) also checks after every DOM-mutating task outside the frame: states a frame
 * would paint if it landed there, which slower devices can paint.
 */
export function startLayoutMonitor({
    label = "LLGAP",
    onViolation,
    strict = false,
}: {
    label?: string;
    onViolation?: (entry: FrameViolation) => void;
    strict?: boolean;
} = {}): LayoutMonitor {
    const lists = new Set<ListCtx>();
    const ids = new WeakMap<ListCtx, number>();
    let nextId = 0;
    const uninstall = installListRegistry(lists);
    const monitor: LayoutMonitor = {
        frames: 0,
        log: [],
        reset() {
            monitor.frames = 0;
            monitor.log.length = 0;
        },
        stop() {
            stopped = true;
            sentinel?.remove();
            mutations?.disconnect();
            uninstall();
        },
        summary() {
            const kinds: Record<string, { frames: number; max: number }> = {};
            for (const entry of monitor.log) {
                const seen = new Set<string>();
                for (const v of entry.violations) {
                    const kind = `${entry.phase === "task" ? "task:" : ""}${v.kind === "blank" ? `blank:${v.source}` : v.kind}`;
                    kinds[kind] ??= { frames: 0, max: 0 };
                    const stat = kinds[kind];
                    if (!seen.has(kind)) stat.frames++;
                    seen.add(kind);
                    const size = "size" in v ? v.size : "expected" in v ? Math.abs(v.actual - v.expected) : 0;
                    stat.max = Math.max(stat.max, size);
                }
            }
            return { frames: monitor.frames, kinds, violationFrames: monitor.log.length };
        },
    };
    let stopped = false;
    const sentinel =
        typeof document !== "undefined" && typeof ResizeObserver !== "undefined"
            ? document.createElement("div")
            : undefined;
    if (sentinel) {
        sentinel.style.cssText = "position:fixed;left:0;top:0;width:1px;height:1px;pointer-events:none";
    }
    const check = (phase: FrameViolation["phase"]) => {
        for (const ctx of lists) {
            if (!ids.has(ctx)) ids.set(ctx, nextId++);
            const violations = [...checkLayoutInvariants(ctx), ...checkDomCoverage(ctx)];
            if (violations.length) {
                const entry: FrameViolation = {
                    frame: monitor.frames,
                    list: ids.get(ctx)!,
                    phase,
                    scroll: ctx.state.scroll,
                    time: Math.round(typeof performance !== "undefined" ? performance.now() : Date.now()),
                    totalSize: ctx.state.totalSize,
                    violations,
                };
                if (monitor.log.length < 5000) monitor.log.push(entry);
                if (onViolation) onViolation(entry);
                else console.log(`[${label}] ${JSON.stringify(entry)}`);
            }
        }
    };
    let inFrame = false;
    const sample = () => {
        if (stopped) return;
        inFrame = false;
        monitor.frames++;
        check("frame");
        requestAnimationFrame(onFrame);
    };
    const mutations =
        strict && sentinel && typeof MutationObserver !== "undefined"
            ? new MutationObserver(() => {
                  if (!inFrame && !stopped) check("task");
              })
            : undefined;
    // A new observer's first notification comes after every older observer's in this frame.
    const onFrame = () => {
        if (!sentinel) return setTimeout(sample, 0);
        // Appended on the first frame: the monitor may start before the document has a root.
        if (!sentinel.isConnected) {
            document.documentElement.appendChild(sentinel);
            mutations?.observe(document.documentElement, { attributes: true, childList: true, subtree: true });
        }
        inFrame = true;
        const observer = new ResizeObserver(() => {
            observer.disconnect();
            sample();
        });
        observer.observe(sentinel);
    };
    requestAnimationFrame(onFrame);
    return monitor;
}
