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

export function buildCalendarMonths(center = new Date(), span = 12) {
    const months: CalendarMonth[] = [];
    const todayKey = center.toISOString().slice(0, 10);

    for (let offset = -span; offset <= span; offset += 1) {
        const monthDate = addMonths(startOfMonth(center), offset);
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
                const dateKey = currentDate.toISOString().slice(0, 10);
                week.push({
                    dateKey,
                    dayNumber: currentDate.getDate(),
                    isCurrentMonth: currentDate.getMonth() === monthDate.getMonth(),
                    isToday: dateKey === todayKey,
                    monthKey: monthStart.toISOString().slice(0, 7),
                });
            }

            weeks.push(week);
        }

        months.push({
            id: monthStart.toISOString().slice(0, 7),
            label: monthLabel,
            weeks,
        });
    }

    return months;
}
