import type React from "react";
import { memo, useMemo, useState } from "react";

import type { LegendListRenderItemProps } from "@legendapp/list";
import { useRecyclingState } from "@legendapp/list";
import { DARK_MODE, PERF_TEST } from "../../../example/constants/constants";

export interface Item {
    id: string;
}

const randomAvatars = Array.from({ length: 20 }, (_, i) => `https://i.pravatar.cc/150?img=${i + 1}`);

export const randomNames = [
    "Alex Thompson",
    "Jordan Lee",
    "Sam Parker",
    "Taylor Kim",
    "Morgan Chen",
    "Riley Zhang",
    "Casey Williams",
    "Quinn Anderson",
    "Blake Martinez",
    "Avery Rodriguez",
    "Drew Campbell",
    "Jamie Foster",
    "Skylar Patel",
    "Charlie Wright",
    "Sage Mitchell",
    "River Johnson",
    "Phoenix Garcia",
    "Jordan Taylor",
    "Reese Cooper",
    "Morgan Bailey",
];

export const loremSentences = [
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
    "Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.",
    "Duis aute irure dolor in reprehenderit in voluptate velit esse.",
    "Excepteur sint occaecat cupidatat non proident, sunt in culpa.",
    "Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit.",
    "Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet.",
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
    "Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.",
    "Duis aute irure dolor in reprehenderit in voluptate velit esse.",
    "Excepteur sint occaecat cupidatat non proident, sunt in culpa.",
    "Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit.",
    "Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet.",
];

export type CardsTheme = "light" | "dark";

const paletteByTheme: Record<
    CardsTheme,
    {
        border: string;
        cardBackground: string;
        divider: string;
        outerBackground: string;
        shadow: string;
        success: string;
        textMuted: string;
        textPrimary: string;
        textSecondary: string;
    }
> = {
    dark: {
        border: "#323232",
        cardBackground: "#141414",
        divider: "#1f1f1f",
        outerBackground: "#050505",
        shadow: "rgba(0, 0, 0, 0.45)",
        success: "#22c55e",
        textMuted: "#9ca3af",
        textPrimary: "#f4f4f5",
        textSecondary: "#d4d4d8",
    },
    light: {
        border: "#e5e7eb",
        cardBackground: "#ffffff",
        divider: "#f3f4f6",
        outerBackground: "#eef1f7",
        shadow: "rgba(0, 0, 0, 0.12)",
        success: "#4CAF50",
        textMuted: "#6b7280",
        textPrimary: "#111827",
        textSecondary: "#374151",
    },
};

const createStyles = (palette: (typeof paletteByTheme)[CardsTheme]) => ({
    authorName: {
        color: palette.textPrimary,
        fontSize: "16px",
        fontWeight: 600,
        lineHeight: 1.4,
    } satisfies React.CSSProperties,
    avatar: {
        borderRadius: "50%",
        height: "40px",
        objectFit: "cover",
        width: "40px",
    } satisfies React.CSSProperties,
    completeButton: {
        background: palette.success,
        border: "none",
        borderRadius: "20px",
        color: "#ffffff",
        cursor: "pointer",
        fontSize: "12px",
        fontWeight: 600,
        padding: "6px 12px",
        textTransform: "uppercase",
    } satisfies React.CSSProperties,
    footerText: {
        color: palette.textMuted,
        fontSize: "14px",
    } satisfies React.CSSProperties,
    headerContainer: {
        alignItems: "center",
        display: "flex",
        gap: "12px",
    } satisfies React.CSSProperties,
    headerText: {
        flex: 1,
        minWidth: 0,
    } satisfies React.CSSProperties,
    itemBody: {
        color: palette.textSecondary,
        fontSize: "14px",
        lineHeight: 1.5,
        margin: 0,
        whiteSpace: "pre-line",
    } satisfies React.CSSProperties,
    itemContainer: {
        background: palette.cardBackground,
        border: `1px solid ${palette.border}`,
        borderRadius: "12px",
        boxShadow: `0 6px 12px ${palette.shadow}`,
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        overflow: "hidden",
        padding: "16px",
        textAlign: "left",
        transition: "transform 120ms ease, box-shadow 120ms ease",
        width: "100%",
    } satisfies React.CSSProperties,
    itemFooter: {
        borderTop: `1px solid ${palette.divider}`,
        display: "flex",
        flexWrap: "wrap",
        gap: "16px",
        marginTop: "4px",
        paddingTop: "12px",
    } satisfies React.CSSProperties,
    itemOuterContainer: {
        background: palette.outerBackground,
        padding: "12px",
        textAlign: "left",
    } satisfies React.CSSProperties,
    itemTitle: {
        color: palette.textPrimary,
        fontSize: "18px",
        fontWeight: 700,
        margin: 0,
    } satisfies React.CSSProperties,
    timestamp: {
        color: palette.textMuted,
        fontSize: "12px",
        marginTop: "2px",
    } satisfies React.CSSProperties,
});

const stylesByTheme: Record<CardsTheme, ReturnType<typeof createStyles>> = {
    dark: createStyles(paletteByTheme.dark),
    light: createStyles(paletteByTheme.light),
};

const DEFAULT_THEME: CardsTheme = DARK_MODE ? "dark" : "light";

const formatPerfSummary = (perfTestResults: {
    fibResult: number;
    primeCheck: boolean;
    processedString: string;
    sortedFiltered: number[];
}) => `🧮 Prime: ${perfTestResults.primeCheck ? "✓" : "✗"} | Fib: ${perfTestResults.fibResult}`;

interface ItemCardProps extends LegendListRenderItemProps<Item> {
    numSentences?: number | ((index: number) => number);
    theme?: CardsTheme;
}

export const ItemCard = memo(({ item, index, extraData, numSentences: numSentencesProp, theme }: ItemCardProps) => {
    const resolvedTheme = theme ?? DEFAULT_THEME;
    const styles = stylesByTheme[resolvedTheme];
    const [isExpandedValue, setIsExpanded] = extraData?.recycleState
        ? useRecyclingState<boolean | null>(() => false)
        : useState<boolean | null>(false);

    const isExpanded = Boolean(isExpandedValue);

    const indexForData = Math.abs(item.id.includes("new") ? 100 + Number(item.id.replace("new", "")) : Number(item.id));

    const perfTestResults = useMemo(() => {
        if (!PERF_TEST) {
            return null;
        }

        const isPrime = (n: number): boolean => {
            if (n <= 1) return false;
            if (n <= 3) return true;
            if (n % 2 === 0 || n % 3 === 0) return false;
            for (let i = 5; i * i <= n; i += 6) {
                if (n % i === 0 || n % (i + 2) === 0) return false;
            }
            return true;
        };

        const fibonacci = (n: number): number => {
            if (n <= 1) return n;
            return fibonacci(n - 1) + fibonacci(n - 2);
        };

        const expensiveStringOp = (str: string): string => {
            let result = str;
            for (let i = 0; i < 50; i += 1) {
                result = result.split("").reverse().join("").toLowerCase().toUpperCase();
            }
            return result.slice(0, 10);
        };

        const primeCheck = isPrime(indexForData + 1000);
        const fibResult = fibonacci(Math.min((indexForData % 20) + 15, 25));
        const processedString = expensiveStringOp(item.id.repeat(10));
        const largeArray = Array.from({ length: 1000 }, () => Math.random() * indexForData);
        const sortedFiltered = largeArray
            .filter((x) => x > indexForData / 2)
            .sort((a, b) => b - a)
            .slice(0, 10);

        return { fibResult, primeCheck, processedString, sortedFiltered };
    }, [indexForData, item.id]);

    const numSentences = useMemo(() => {
        if (!numSentencesProp) {
            return ((indexForData * 7919) % 12) + 1;
        }

        if (typeof numSentencesProp === "function") {
            return numSentencesProp(indexForData);
        }

        return numSentencesProp;
    }, [indexForData, numSentencesProp]);

    const randomText = useMemo(
        () => Array.from({ length: numSentences }, (_, i) => loremSentences[i % loremSentences.length]).join(" "),
        [numSentences],
    );

    const avatarUrl = randomAvatars[indexForData % randomAvatars.length];
    const authorName = randomNames[indexForData % randomNames.length];
    const timestamp = `${Math.max(1, indexForData % 24)}h ago`;

    return (
        <div style={styles.itemOuterContainer}>
            <button
                onClick={(event) => {
                    event.preventDefault();
                    setIsExpanded((prev) => !prev);
                }}
                onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setIsExpanded((prev) => !prev);
                    }
                }}
                style={styles.itemContainer}
                tabIndex={0}
                type="button"
            >
                <div style={styles.headerContainer}>
                    <img alt={`${authorName} avatar`} src={avatarUrl} style={styles.avatar} />
                    <div style={styles.headerText}>
                        <div style={styles.authorName}>
                            {authorName} {item.id}
                        </div>
                        <div style={styles.timestamp}>{timestamp}</div>
                    </div>
                    <button
                        onClick={(event) => {
                            event.stopPropagation();
                            event.preventDefault();
                            console.log(`Marked item ${item.id} as complete`);
                        }}
                        style={styles.completeButton}
                        type="button"
                    >
                        Complete
                    </button>
                </div>
                <h3 style={styles.itemTitle}>Item #{item.id}</h3>
                <p style={styles.itemBody}>
                    {randomText}
                    {isExpanded ? ` ${randomText}` : ""}
                </p>
                <div style={styles.itemFooter}>
                    <span style={styles.footerText}>❤️ 42</span>
                    <span style={styles.footerText}>💬 12</span>
                    <span style={styles.footerText}>🔄 8</span>
                    {perfTestResults ? (
                        <span style={styles.footerText}>{formatPerfSummary(perfTestResults)}</span>
                    ) : null}
                </div>
            </button>
        </div>
    );
});

export const createCardsRenderItem =
    (theme: CardsTheme = DEFAULT_THEME) =>
    (props: LegendListRenderItemProps<Item>) => <ItemCard {...props} theme={theme} />;

export const renderItem = createCardsRenderItem();

export default renderItem;
