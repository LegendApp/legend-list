export type CalendarDay = {
    dateKey: string;
    dayNumber: number;
    isCurrentMonth: boolean;
    isToday: boolean;
    monthKey: string;
};

export type CalendarMonth = {
    id: string;
    label: string;
    weeks: CalendarDay[][];
};

function startOfMonth(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, amount: number) {
    return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function addDays(date: Date, amount: number) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount);
}

function pad2(value: number) {
    return String(value).padStart(2, "0");
}

function formatDateKey(date: Date) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function formatMonthKey(date: Date) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
}

function parseMonthKey(monthId: string) {
    const [yearText, monthText] = monthId.split("-");
    return new Date(Number(yearText), Number(monthText) - 1, 1);
}

function buildCalendarMonth(monthDate: Date, todayKey: string) {
    const monthStart = startOfMonth(monthDate);
    const monthLabel = monthDate.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
    });
    const firstWeekday = monthStart.getDay();
    const gridStart = addDays(monthStart, -firstWeekday);
    const weeks: CalendarDay[][] = [];

    for (let weekIndex = 0; weekIndex < 6; weekIndex += 1) {
        const week: CalendarDay[] = [];

        for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
            const currentDate = addDays(gridStart, weekIndex * 7 + dayIndex);
            const dateKey = formatDateKey(currentDate);
            week.push({
                dateKey,
                dayNumber: currentDate.getDate(),
                isCurrentMonth: currentDate.getMonth() === monthDate.getMonth(),
                isToday: dateKey === todayKey,
                monthKey: formatMonthKey(monthStart),
            });
        }

        weeks.push(week);
    }

    return {
        id: formatMonthKey(monthStart),
        label: monthLabel,
        weeks,
    } satisfies CalendarMonth;
}

export function getCalendarMonthId(date = new Date()) {
    return formatMonthKey(startOfMonth(date));
}

export function shiftCalendarMonthId(monthId: string, amount: number) {
    return formatMonthKey(addMonths(parseMonthKey(monthId), amount));
}

export function buildCalendarMonthRange(startMonthId: string, count: number, today = new Date()) {
    const startMonth = parseMonthKey(startMonthId);
    const todayKey = formatDateKey(today);

    return Array.from({ length: count }, (_, index) => buildCalendarMonth(addMonths(startMonth, index), todayKey));
}

export function buildCalendarMonths(center = new Date(), span = 12, today = center) {
    const months: CalendarMonth[] = [];
    const todayKey = formatDateKey(today);

    for (let offset = -span; offset <= span; offset += 1) {
        const monthDate = addMonths(startOfMonth(center), offset);
        months.push(buildCalendarMonth(monthDate, todayKey));
    }

    return months;
}
