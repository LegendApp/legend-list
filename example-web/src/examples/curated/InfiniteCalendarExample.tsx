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

function monthIndex(months: CalendarMonth[], activeMonthId: string) {
    const index = months.findIndex((month) => month.id === activeMonthId);
    return index === -1 ? 0 : index;
}

function prependCalendarMonths(months: CalendarMonth[], count: number, today: Date) {
    const startMonthId = shiftCalendarMonthId(months[0]!.id, -count);
    console.log("older", startMonthId);

    return [...buildCalendarMonthRange(startMonthId, count, today), ...months];
}

function appendCalendarMonths(months: CalendarMonth[], count: number, today: Date) {
    const startMonthId = shiftCalendarMonthId(months[months.length - 1]!.id, 1);
    return [...months, ...buildCalendarMonthRange(startMonthId, count, today)];
}

export function InfiniteCalendarExample() {
    const today = React.useMemo(() => new Date(), []);
    const todayMonthId = React.useMemo(() => getCalendarMonthId(today), [today]);
    const [months, setMonths] = React.useState(() => buildCalendarMonths(today, CALENDAR_INITIAL_SPAN, today));
    const [mode, setMode] = React.useState<"vertical" | "horizontal">("vertical");
    const [activeMonthId, setActiveMonthId] = React.useState(todayMonthId);
    const [monthWidth, setMonthWidth] = React.useState(0);
    const listRef = React.useRef<LegendListRef | null>(null);
    const pendingScrollTargetRef = React.useRef<string | null>(null);
    const viewportRef = React.useRef<HTMLDivElement | null>(null);
    const activeIndex = monthIndex(months, activeMonthId);

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

    React.useEffect(() => {
        pendingScrollTargetRef.current = activeMonthId;
    }, [activeMonthId, mode]);

    React.useEffect(() => {
        const pendingTarget = pendingScrollTargetRef.current;
        if (!pendingTarget) {
            return;
        }

        if (mode === "horizontal" && monthWidth === 0) {
            return;
        }

        const index = monthIndex(months, pendingTarget);
        const frame = window.requestAnimationFrame(() => {
            listRef.current?.scrollToIndex({
                animated: pendingTarget !== activeMonthId,
                index,
                viewPosition: 0,
            });
            pendingScrollTargetRef.current = null;
        });

        return () => window.cancelAnimationFrame(frame);
    }, [activeMonthId, mode, monthWidth, months]);

    const ensureMonthVisible = React.useCallback(
        (targetMonthId: string) => {
            pendingScrollTargetRef.current = targetMonthId;
            setMonths((current) => {
                let next = current;

                while (targetMonthId < next[0]!.id) {
                    next = prependCalendarMonths(next, CALENDAR_PAGE_SIZE, today);
                }

                while (targetMonthId > next[next.length - 1]!.id) {
                    next = appendCalendarMonths(next, CALENDAR_PAGE_SIZE, today);
                }

                return next;
            });
            setActiveMonthId(targetMonthId);
        },
        [today],
    );

    const loadOlder = React.useCallback(() => {
        setMonths((current) => prependCalendarMonths(current, CALENDAR_PAGE_SIZE, today));
    }, [today]);

    const loadNewer = React.useCallback(() => {
        setMonths((current) => appendCalendarMonths(current, CALENDAR_PAGE_SIZE, today));
    }, [today]);

    const horizontalPageWidth = mode === "horizontal" ? 320 : undefined;

    return (
        <Shell title="Infinite Calendar">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col" ref={viewportRef}>
                <div className="mb-3 flex gap-3">
                    <button
                        className={buttonStyle(mode === "vertical")}
                        onClick={() => setMode("vertical")}
                        type="button"
                    >
                        Vertical
                    </button>
                    <button
                        className={buttonStyle(mode === "horizontal")}
                        onClick={() => setMode("horizontal")}
                        type="button"
                    >
                        Horizontal
                    </button>
                    <button
                        className={buttonStyle()}
                        onClick={() => ensureMonthVisible(shiftCalendarMonthId(activeMonthId, -1))}
                        type="button"
                    >
                        Prev
                    </button>
                    <button className={buttonStyle()} onClick={() => ensureMonthVisible(todayMonthId)} type="button">
                        Today
                    </button>
                    <button
                        className={buttonStyle()}
                        onClick={() => ensureMonthVisible(shiftCalendarMonthId(activeMonthId, 1))}
                        type="button"
                    >
                        Next
                    </button>
                </div>
                <LegendList
                    data={months}
                    estimatedItemSize={mode === "horizontal" ? 332 : 340}
                    horizontal={mode === "horizontal"}
                    initialScrollIndex={activeIndex}
                    key={mode}
                    keyExtractor={(item) => item.id}
                    maintainVisibleContentPosition
                    onEndReached={loadNewer}
                    onEndReachedThreshold={0.25}
                    onStartReached={loadOlder}
                    onStartReachedThreshold={0.25}
                    onViewableItemsChanged={({ viewableItems }) => {
                        const visibleMonths = viewableItems
                            .map((viewableItem) => viewableItem.item as CalendarMonth | undefined)
                            .filter((month): month is CalendarMonth => Boolean(month));
                        const nextActive = visibleMonths[0];
                        if (nextActive?.id && pendingScrollTargetRef.current == null) {
                            setActiveMonthId((current) => (current === nextActive.id ? current : nextActive.id));
                        }
                    }}
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
                                    border: item.id === activeMonthId ? "1px solid #1d4ed8" : "1px solid #e5e7eb",
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
