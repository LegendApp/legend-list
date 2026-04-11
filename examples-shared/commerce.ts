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
const shelfNames = ["New Arrivals", "Workspace Picks", "Weekend Essentials", "Top Rated"] as const;

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
        items: Array.from({ length: 8 }, (_, itemIndex) => ({
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

export function buildFeedCards() {
    return [
        {
            author: "Avery Chen",
            body: "Shipped the new measurement overlay and tightened the scroll anchor behavior on dynamic rows.",
            id: "feed-1",
            reactionCount: 18,
            title: "Release Notes",
        },
        {
            author: "Jordan Kim",
            body: "Testing the revised card feed with image-heavy posts and swipe actions. The recycled cells now preserve interaction state cleanly.",
            id: "feed-2",
            reactionCount: 34,
            title: "Feed QA",
        },
        {
            author: "Morgan Patel",
            body: "Pinned a new benchmark result comparing cold render time and steady-state scroll under mixed row heights.",
            id: "feed-3",
            reactionCount: 22,
            title: "Bench Snapshot",
        },
    ] satisfies FeedCard[];
}

export type InboxNotification = {
    body: string;
    id: string;
    isUnread: boolean;
    timeLabel: string;
    title: string;
};

export function buildInboxNotifications(count = 16) {
    return Array.from({ length: count }, (_, index) => ({
        body: index % 2 === 0 ? "A new summary is ready for review." : "Someone reacted to your shared collection.",
        id: `notification-${index}`,
        isUnread: index < 5,
        timeLabel: index < 3 ? "Now" : `${index + 3}m`,
        title: index % 3 === 0 ? "Team update" : "Activity alert",
    })) satisfies InboxNotification[];
}

export type ActivityItem = {
    amountLabel: string;
    id: string;
    kind: "credit" | "debit";
    summary: string;
    timeLabel: string;
};

export function buildActivityItems(center = 0, count = 24) {
    return Array.from({ length: count }, (_, index) => {
        const value = center + index - Math.floor(count / 2);
        const isCredit = value % 3 === 0;

        return {
            amountLabel: `${isCredit ? "+" : "-"}$${Math.abs(value * 7 + 48)}`,
            id: `activity-${value}`,
            kind: isCredit ? "credit" : "debit",
            summary: isCredit ? "Refund processed" : "Order captured",
            timeLabel: `Apr ${10 + (value % 12 + 12) % 12}`,
        } satisfies ActivityItem;
    });
}

export type GalleryItem = {
    color: string;
    id: string;
    title: string;
    tone: string;
};

export function buildGalleryItems(count = 24) {
    const random = createSeededRandom(90210);
    const tones = ["Soft Light", "Clay", "Ocean", "Forest", "Sunset", "Stone"] as const;

    return Array.from({ length: count }, (_, index) => ({
        color: pickOne(productColors, random),
        id: `gallery-${index}`,
        title: `Look ${index + 1}`,
        tone: pickOne(tones, random),
    })) satisfies GalleryItem[];
}
