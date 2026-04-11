import { createSeededRandom, pickOne } from "./random";

const productTitles = [
    "Studio Lamp",
    "Travel Bottle",
    "Desk Clock",
    "Canvas Tote",
    "Crew Socks",
    "Ceramic Mug",
    "Floor Cushion",
    "Note Set",
    "Tea Tin",
    "Carry Case",
] as const;

const productColors = ["#F4D35E", "#EE964B", "#F95738", "#0D3B66", "#7BD389", "#D6D1B1"] as const;
const shelfNames = [
    "New Arrivals",
    "Workspace Picks",
    "Weekend Essentials",
    "Top Rated",
    "Travel Ready",
    "Studio Refresh",
    "Daily Carry",
    "Small Gifts",
] as const;

export type ProductCard = {
    color: string;
    id: string;
    priceLabel: string;
    title: string;
};

export type ProductShelfSection = {
    id: string;
    items: ProductCard[];
    title: string;
};

export function buildProductShelf() {
    const random = createSeededRandom(1128);

    return shelfNames.map((title, sectionIndex) => ({
        id: `section-${sectionIndex}`,
        items: Array.from({ length: 12 }, (_, itemIndex) => ({
            color: pickOne(productColors, random),
            id: `product-${sectionIndex}-${itemIndex}`,
            priceLabel: `$${(18 + Math.floor(random() * 42)).toFixed(2)}`,
            title: pickOne(productTitles, random),
        })),
        title,
    })) satisfies ProductShelfSection[];
}

export type FeedCard = {
    author: string;
    body: string;
    id: string;
    reactionCount: number;
    title: string;
};

const feedAuthors = [
    "Avery Chen",
    "Jordan Kim",
    "Morgan Patel",
    "Nina Brooks",
    "Sam Rivera",
    "Quinn Foster",
] as const;

const feedTitles = [
    "Release Notes",
    "Feed QA",
    "Bench Snapshot",
    "Launch Debrief",
    "Design Review",
    "Support Pulse",
] as const;

const feedBodies = [
    "Shipped the new measurement overlay and tightened the scroll anchor behavior on dynamic rows.",
    "Testing the revised card feed with image-heavy posts and swipe actions. The recycled cells now preserve interaction state cleanly.",
    "Pinned a new benchmark result comparing cold render time and steady-state scroll under mixed row heights.",
    "Documented the fallback path for variable-size rows so the list holds position while content streams in.",
    "Refined the card composition to keep avatars, actions, and media blocks stable as cells recycle.",
    "Captured another batch of reports from long-session scrolling and queued follow-up fixture cases for edge paths.",
] as const;

export function buildFeedCards(count = 84) {
    return Array.from({ length: count }, (_, index) => ({
        author: feedAuthors[index % feedAuthors.length]!,
        body: `${feedBodies[index % feedBodies.length]!} ${feedBodies[(index + 2) % feedBodies.length]!}`,
        id: `feed-${index + 1}`,
        reactionCount: 18 + ((index * 7) % 29),
        title: feedTitles[index % feedTitles.length]!,
    })) satisfies FeedCard[];
}

export type InboxNotification = {
    body: string;
    id: string;
    isUnread: boolean;
    timeLabel: string;
    title: string;
};

export function buildInboxNotifications(count = 96) {
    return Array.from({ length: count }, (_, index) => ({
        body:
            index % 2 === 0
                ? "A new summary is ready for review, including the latest scroll performance report and follow-up notes."
                : "Someone reacted to your shared collection and added a note about the recycled row state staying intact.",
        id: `notification-${index}`,
        isUnread: index < 12,
        timeLabel: index < 4 ? "Now" : `${index + 3}m`,
        title: index % 3 === 0 ? "Team update" : index % 3 === 1 ? "Activity alert" : "Release note",
    })) satisfies InboxNotification[];
}

export type ActivityItem = {
    amountLabel: string;
    categoryLabel: string;
    detailLines: string[];
    id: string;
    kind: "credit" | "debit";
    merchant: string;
    monthLabel: string;
    sequence: number;
    status: "pending" | "posted" | "reversed";
    summary: string;
    timeLabel: string;
};

export type ActivityHistoryRow =
    | {
          id: string;
          pendingCount: number;
          title: string;
          totalLabel: string;
          type: "header";
      }
    | {
          id: string;
          item: ActivityItem;
          type: "item";
      };

const activityBaseDate = new Date(Date.UTC(2026, 3, 11, 17, 20));
const activityCategories = ["Card", "Transfer", "Payout", "Refund", "Authorization", "Adjustment"] as const;
const activityMerchants = [
    "Northwind Studio",
    "Atlas Wholesale",
    "Summit Labs",
    "Harbor Transit",
    "Morrow Café",
    "Signal Works",
    "Cinder Energy",
    "Lattice Books",
] as const;
const activitySummaries = [
    "Invoice settled",
    "Order captured",
    "Refund processed",
    "Transfer released",
    "Payout completed",
    "Subscription renewed",
    "Card charge collected",
    "Balance adjustment",
] as const;
const activityDetailTemplates = [
    "The entry remained anchored while more rows were inserted above it.",
    "Metadata expanded after settlement without shifting the visible window.",
    "The detail panel includes multiple paragraphs to vary row height.",
    "Grouped headers stay pinned while mixed-height rows recycle beneath them.",
    "Pending events can settle in place instead of being replaced wholesale.",
] as const;
const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

function formatActivityMonth(date: Date) {
    return `${monthNames[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

function formatActivityTime(date: Date) {
    const hours24 = date.getUTCHours();
    const hours12 = hours24 % 12 || 12;
    const minutes = date.getUTCMinutes().toString().padStart(2, "0");
    const meridiem = hours24 >= 12 ? "PM" : "AM";
    return `${monthNames[date.getUTCMonth()]} ${date.getUTCDate()} · ${hours12}:${minutes} ${meridiem}`;
}

function buildActivityItem(sequence: number): ActivityItem {
    const random = createSeededRandom(sequence * 4099 + 8123);
    const date = new Date(activityBaseDate.getTime() + sequence * 27 * 60 * 60 * 1000);
    const isCredit = sequence % 4 === 0 || sequence % 11 === 0;
    const merchant = pickOne(activityMerchants, random);
    const summary = pickOne(activitySummaries, random);
    const categoryLabel = pickOne(activityCategories, random);
    const detailCount = 1 + Math.floor(random() * 3);
    const detailLines = Array.from({ length: detailCount }, (_, index) => {
        const template = activityDetailTemplates[(Math.abs(sequence) + index) % activityDetailTemplates.length]!;
        return `${template} ${merchant} routed this through ${categoryLabel.toLowerCase()} step ${index + 1}.`;
    });
    let status: ActivityItem["status"] = "posted";
    if (sequence > -6 && sequence % 5 === 0) {
        status = "pending";
    } else if (sequence % 17 === 0) {
        status = "reversed";
    }

    return {
        amountLabel: `${isCredit ? "+" : "-"}$${Math.abs(sequence * 13 + 74)}`,
        categoryLabel,
        detailLines,
        id: `activity-${sequence}`,
        kind: isCredit ? "credit" : "debit",
        merchant,
        monthLabel: formatActivityMonth(date),
        sequence,
        status,
        summary,
        timeLabel: formatActivityTime(date),
    } satisfies ActivityItem;
}

export function buildActivityItemsFromSequence(startSequence: number, count: number): ActivityItem[] {
    return Array.from({ length: count }, (_, index) => buildActivityItem(startSequence + index));
}

export function buildActivityItems(center = 0, count = 108): ActivityItem[] {
    const startSequence = center - Math.floor(count / 2);
    return buildActivityItemsFromSequence(startSequence, count);
}

export function prependActivityItems(items: ActivityItem[], count = 12): ActivityItem[] {
    const startSequence = (items[0]?.sequence ?? 0) - count;
    return [...buildActivityItemsFromSequence(startSequence, count), ...items];
}

export function appendActivityItems(items: ActivityItem[], count = 4): ActivityItem[] {
    const startSequence = (items[items.length - 1]?.sequence ?? -1) + 1;
    return [...items, ...buildActivityItemsFromSequence(startSequence, count)];
}

export function settlePendingActivityItems(items: ActivityItem[], count = 3): ActivityItem[] {
    let remaining = count;

    return items.map((item) => {
        if (remaining === 0 || item.status !== "pending") {
            return item;
        }

        remaining -= 1;

        return {
            ...item,
            detailLines: [
                ...item.detailLines,
                remaining % 2 === 0
                    ? "Settlement completed and downstream ledgers reconciled."
                    : "The pending hold rolled into a posted entry without shifting the surrounding rows.",
            ],
            status: item.sequence % 2 === 0 ? "posted" : "reversed",
        };
    });
}

export function buildActivityHistoryRows(items: ActivityItem[]): {
    rows: ActivityHistoryRow[];
    stickyHeaderIndices: number[];
} {
    const rows: ActivityHistoryRow[] = [];
    const stickyHeaderIndices: number[] = [];
    const monthCounts = new Map<string, { pendingCount: number; totalCount: number }>();
    let currentMonthLabel: string | null = null;

    for (const item of items) {
        const current = monthCounts.get(item.monthLabel);
        monthCounts.set(item.monthLabel, {
            pendingCount: (current?.pendingCount ?? 0) + (item.status === "pending" ? 1 : 0),
            totalCount: (current?.totalCount ?? 0) + 1,
        });
    }

    for (const item of items) {
        if (currentMonthLabel !== item.monthLabel) {
            const monthCount = monthCounts.get(item.monthLabel)!;
            stickyHeaderIndices.push(rows.length);
            rows.push({
                id: `header-${item.monthLabel}`,
                pendingCount: monthCount.pendingCount,
                title: item.monthLabel,
                totalLabel: `${monthCount.totalCount} entries`,
                type: "header",
            });
            currentMonthLabel = item.monthLabel;
        }

        rows.push({
            id: item.id,
            item,
            type: "item",
        });
    }

    return { rows, stickyHeaderIndices };
}

export type GalleryItem = {
    color: string;
    id: string;
    title: string;
    tone: string;
};

export function buildGalleryItems(count = 96) {
    const random = createSeededRandom(90210);
    const tones = ["Soft Light", "Clay", "Ocean", "Forest", "Sunset", "Stone"] as const;

    return Array.from({ length: count }, (_, index) => ({
        color: pickOne(productColors, random),
        id: `gallery-${index}`,
        title: `Look ${index + 1}`,
        tone: pickOne(tones, random),
    })) satisfies GalleryItem[];
}
