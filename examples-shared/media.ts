import { createSeededRandom, pickOne } from "./random";

const railTitles = ["Trending Now", "Recently Added", "Because You Watched", "Weekend Picks"] as const;
const mediaColors = ["#264653", "#2A9D8F", "#E9C46A", "#F4A261", "#E76F51", "#7A6C5D"] as const;

export type MediaPoster = {
    color: string;
    id: string;
    subtitle: string;
    title: string;
};

export type MediaRail = {
    id: string;
    posters: MediaPoster[];
    title: string;
};

export function buildMediaRails() {
    const random = createSeededRandom(7007);

    return railTitles.map((title, railIndex) => ({
        id: `rail-${railIndex}`,
        posters: Array.from({ length: 12 }, (_, posterIndex) => ({
            color: pickOne(mediaColors, random),
            id: `poster-${railIndex}-${posterIndex}`,
            subtitle: posterIndex % 2 === 0 ? "42 min" : "Feature",
            title: `Feature ${railIndex + 1}.${posterIndex + 1}`,
        })),
        title,
    })) satisfies MediaRail[];
}

export type VideoClip = {
    color: string;
    creator: string;
    id: string;
    title: string;
};

export function buildVideoFeed(count = 10) {
    const creators = ["Studio North", "Field Notes", "Signal Lab", "Open Frame"] as const;
    const random = createSeededRandom(31415);

    return Array.from({ length: count }, (_, index) => ({
        color: pickOne(mediaColors, random),
        creator: pickOne(creators, random),
        id: `clip-${index}`,
        title: `Clip ${index + 1}`,
    })) satisfies VideoClip[];
}
