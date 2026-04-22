import React from "react";

import { LegendList, type LegendListRef } from "@legendapp/list/react";
import {
    buildCalendarMonthRange,
    buildCalendarMonths,
    type CalendarMonth,
    getCalendarMonthId,
    shiftCalendarMonthId,
} from "@examples/calendar";
import { buttonStyle, CARD_CLASS, cardStyle, listViewportStyle, Shell } from "./shared";

const CALENDAR_INITIAL_SPAN = 12;
const CALENDAR_PAGE_SIZE = 6;
const HORIZONTAL_MONTH_SIZE = 320;
const VERTICAL_MONTH_SIZE = 406;

function monthIndex(months: CalendarMonth[], activeMonthId: string) {
    const index = months.findIndex((month) => month.id === activeMonthId);
    return index === -1 ? 0 : index;
}

function prependCalendarMonths(months: CalendarMonth[], count: number, today: Date) {
    const startMonthId = shiftCalendarMonthId(months[0]!.id, -count);
    return [...buildCalendarMonthRange(startMonthId, count, today), ...months];
}

function appendCalendarMonths(months: CalendarMonth[], count: number, today: Date) {
    const startMonthId = shiftCalendarMonthId(months[months.length - 1]!.id, 1);
    return [...months, ...buildCalendarMonthRange(startMonthId, count, today)];
}

function ensureMonthRange(months: CalendarMonth[], targetMonthId: string, today: Date) {
    let next = months;

    while (targetMonthId < next[0]!.id) {
        next = prependCalendarMonths(next, CALENDAR_PAGE_SIZE, today);
    }

    while (targetMonthId > next[next.length - 1]!.id) {
        next = appendCalendarMonths(next, CALENDAR_PAGE_SIZE, today);
    }

    return next;
}

export function InfiniteCalendarExample() {
    const today = React.useMemo(() => new Date(), []);
    const todayMonthId = React.useMemo(() => getCalendarMonthId(today), [today]);
    const [months, setMonths] = React.useState(() => buildCalendarMonths(today, CALENDAR_INITIAL_SPAN, today));
    const [mode, setMode] = React.useState<"vertical" | "horizontal">("vertical");
    const [monthWidth, setMonthWidth] = React.useState(0);
    const listRef = React.useRef<LegendListRef | null>(null);
    const monthsRef = React.useRef(months);
    const modeRef = React.useRef(mode);
    const monthWidthRef = React.useRef(monthWidth);
    const viewportRef = React.useRef<HTMLDivElement | null>(null);
    const activeIndex = monthIndex(months, todayMonthId);
    monthsRef.current = months;
    modeRef.current = mode;
    monthWidthRef.current = monthWidth;

    React.useEffect(() => {
        const viewport = viewportRef.current;
        if (!viewport) {
            return;
        }

        const updateMonthWidth = () => {
            setMonthWidth(Math.max(0, Math.floor(viewport.getBoundingClientRect().width)));
        };

        updateMonthWidth();
        const observer = new ResizeObserver(() => {
            updateMonthWidth();
        });
        observer.observe(viewport);

        return () => {
            observer.disconnect();
        };
    }, []);

    const scheduleScrollToMonth = React.useCallback((targetMonthId: string, animated: boolean) => {
        let attempts = 0;

        const run = () => {
            const currentMonths = monthsRef.current;
            const index = currentMonths.findIndex((month) => month.id === targetMonthId);
            const isHorizontal = modeRef.current === "horizontal";

            if (!listRef.current || index === -1 || (isHorizontal && monthWidthRef.current === 0)) {
                if (attempts < 12) {
                    attempts += 1;
                    window.requestAnimationFrame(run);
                }
                return;
            }

            listRef.current.scrollToIndex({
                animated,
                index,
                viewPosition: 0.5,
            });
        };

        window.requestAnimationFrame(run);
    }, []);

    const getCenteredMonthId = React.useCallback(() => {
        const state = listRef.current?.getState();
        const scroller = listRef.current?.getNativeScrollRef?.() as HTMLElement | null | undefined;
        const currentMonths = monthsRef.current;
        if (!state || !scroller || currentMonths.length === 0) {
            return todayMonthId;
        }

        const start = Math.max(0, Math.min(currentMonths.length - 1, state.start));
        const end = Math.max(start, Math.min(currentMonths.length - 1, state.end));
        const isHorizontal = modeRef.current === "horizontal";
        const viewportRect = scroller.getBoundingClientRect();
        const viewportCenter = isHorizontal
            ? viewportRect.left + viewportRect.width / 2
            : viewportRect.top + viewportRect.height / 2;
        let closestIndex: number | undefined;
        let closestDistance = Number.POSITIVE_INFINITY;

        for (let index = start; index <= end; index += 1) {
            const element = state.elementAtIndex(index);
            const rect = element?.getBoundingClientRect?.();
            if (!rect) {
                continue;
            }

            const itemCenter = isHorizontal ? rect.left + rect.width / 2 : rect.top + rect.height / 2;
            const distance = Math.abs(itemCenter - viewportCenter);
            if (distance < closestDistance) {
                closestDistance = distance;
                closestIndex = index;
            }
        }

        const fallbackIndex = closestIndex ?? Math.floor((start + end) / 2);
        return currentMonths[fallbackIndex]?.id ?? todayMonthId;
    }, [todayMonthId]);

    const ensureMonthVisible = React.useCallback(
        (targetMonthId: string) => {
            setMonths((current) => ensureMonthRange(current, targetMonthId, today));
            scheduleScrollToMonth(targetMonthId, true);
        },
        [scheduleScrollToMonth, today],
    );

    const switchMode = React.useCallback(
        (nextMode: "vertical" | "horizontal") => {
            setMonths((current) => ensureMonthRange(current, todayMonthId, today));
            setMode(nextMode);
            scheduleScrollToMonth(todayMonthId, false);
        },
        [scheduleScrollToMonth, today, todayMonthId],
    );

    const loadOlder = React.useCallback(() => {
        setMonths((current) => prependCalendarMonths(current, CALENDAR_PAGE_SIZE, today));
    }, [today]);

    const loadNewer = React.useCallback(() => {
        setMonths((current) => appendCalendarMonths(current, CALENDAR_PAGE_SIZE, today));
    }, [today]);

    const horizontalPageWidth = mode === "horizontal" ? HORIZONTAL_MONTH_SIZE : undefined;

    return (
        <Shell title="Infinite Calendar">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col" ref={viewportRef}>
                <div className="mb-3 flex gap-3">
                    <button
                        className={buttonStyle(mode === "vertical")}
                        onClick={() => switchMode("vertical")}
                        type="button"
                    >
                        Vertical
                    </button>
                    <button
                        className={buttonStyle(mode === "horizontal")}
                        onClick={() => switchMode("horizontal")}
                        type="button"
                    >
                        Horizontal
                    </button>
                    <button
                        className={buttonStyle()}
                        onClick={() => ensureMonthVisible(shiftCalendarMonthId(getCenteredMonthId(), -1))}
                        type="button"
                    >
                        Prev
                    </button>
                    <button className={buttonStyle()} onClick={() => ensureMonthVisible(todayMonthId)} type="button">
                        Today
                    </button>
                    <button
                        className={buttonStyle()}
                        onClick={() => ensureMonthVisible(shiftCalendarMonthId(getCenteredMonthId(), 1))}
                        type="button"
                    >
                        Next
                    </button>
                </div>
                <LegendList
                    data={months}
                    estimatedItemSize={mode === "horizontal" ? HORIZONTAL_MONTH_SIZE : VERTICAL_MONTH_SIZE}
                    horizontal={mode === "horizontal"}
                    initialScrollIndex={activeIndex}
                    key={mode}
                    keyExtractor={(item) => item.id}
                    maintainVisibleContentPosition
                    onEndReached={loadNewer}
                    onEndReachedThreshold={0.25}
                    onStartReached={loadOlder}
                    onStartReachedThreshold={0.25}
                    recycleItems
                    ref={listRef}
                    renderItem={({ item }: { item: CalendarMonth }) => (
                        <div
                            className="box-border"
                            style={{
                                flex: mode === "horizontal" ? "0 0 auto" : undefined,
                                paddingRight: mode === "horizontal" ? 12 : 0,
                                width: horizontalPageWidth,
                            }}
                        >
                            <div
                                className={CARD_CLASS}
                                style={{
                                    ...cardStyle(),
                                }}
                            >
                                <h2 className="mt-0">{item.label}</h2>
                                {item.weeks.map((week, weekIndex) => (
                                    <div className="mt-2 flex gap-2" key={weekIndex}>
                                        {week.map((day) => (
                                            <div
                                                className="flex-1 rounded-[10px] py-[10px] text-center"
                                                key={day.dateKey}
                                                style={{
                                                    background: day.isToday ? "#111827" : "#e5e7eb",
                                                    color: day.isToday ? "#fff" : "#111827",
                                                    opacity: day.isCurrentMonth ? 1 : 0.35,
                                                }}
                                            >
                                                {day.dayNumber}
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    style={
                        mode === "horizontal"
                            ? {
                                  ...listViewportStyle,
                                  overscrollBehaviorX: "contain",
                                  width: "100%",
                              }
                            : listViewportStyle
                    }
                />
            </div>
        </Shell>
    );
}
