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
    id: string;
    kind: "credit" | "debit";
    summary: string;
    timeLabel: string;
};

export function buildActivityItems(center = 0, count = 108) {
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
