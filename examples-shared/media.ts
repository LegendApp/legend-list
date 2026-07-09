import playlist12_18 from "../example/api/data/playlist/12-18.json";
import playlist14_36 from "../example/api/data/playlist/14-36.json";
import playlist16_53 from "../example/api/data/playlist/16-53.json";
import playlist18_10752 from "../example/api/data/playlist/18-10752.json";
import playlist27_10770 from "../example/api/data/playlist/27-10770.json";
import playlist28_16 from "../example/api/data/playlist/28-16.json";
import playlist28_53 from "../example/api/data/playlist/28-53.json";
import playlist28_10749 from "../example/api/data/playlist/28-10749.json";
import playlist35_10749 from "../example/api/data/playlist/35-10749.json";
import playlist35_10752 from "../example/api/data/playlist/35-10752.json";
import playlist36_9648 from "../example/api/data/playlist/36-9648.json";
import playlist99_18 from "../example/api/data/playlist/99-18.json";
import playlist99_27 from "../example/api/data/playlist/99-27.json";
import playlist99_53 from "../example/api/data/playlist/99-53.json";
import playlist99_9648 from "../example/api/data/playlist/99-9648.json";
import playlist99_10749 from "../example/api/data/playlist/99-10749.json";
import playlist9648_37 from "../example/api/data/playlist/9648-37.json";
import playlist9648_53 from "../example/api/data/playlist/9648-53.json";
import playlist9648_878 from "../example/api/data/playlist/9648-878.json";
import playlist10749_10752 from "../example/api/data/playlist/10749-10752.json";
import playlist10751_37 from "../example/api/data/playlist/10751-37.json";
import playlist10751_9648 from "../example/api/data/playlist/10751-9648.json";
import playlist10751_10402 from "../example/api/data/playlist/10751-10402.json";
import playlist10752_37 from "../example/api/data/playlist/10752-37.json";
import rows from "../example/api/data/rows.json";
import { createSeededRandom, pickOne } from "./random";

const mediaColors = ["#264653", "#2A9D8F", "#E9C46A", "#F4A261", "#E76F51", "#7A6C5D"] as const;
const POSTER_BASE_URL = "https://image.tmdb.org/t/p/w342";
const MEDIA_RAIL_COUNT = 24;

type MediaRow = {
    id: string;
    title: string;
};

type MovieFixture = {
    id: number;
    poster_path: string | null | undefined;
    release_date?: string;
    title: string;
    vote_average: number;
};

const playlistMap: Record<string, MovieFixture[]> = {
    "12-18": playlist12_18,
    "14-36": playlist14_36,
    "16-53": playlist16_53,
    "18-10752": playlist18_10752,
    "27-10770": playlist27_10770,
    "28-16": playlist28_16,
    "28-53": playlist28_53,
    "28-10749": playlist28_10749,
    "35-10749": playlist35_10749,
    "35-10752": playlist35_10752,
    "36-9648": playlist36_9648,
    "99-18": playlist99_18,
    "99-27": playlist99_27,
    "99-53": playlist99_53,
    "99-9648": playlist99_9648,
    "99-10749": playlist99_10749,
    "9648-37": playlist9648_37,
    "9648-53": playlist9648_53,
    "9648-878": playlist9648_878,
    "10749-10752": playlist10749_10752,
    "10751-37": playlist10751_37,
    "10751-9648": playlist10751_9648,
    "10751-10402": playlist10751_10402,
    "10752-37": playlist10752_37,
};

function hasPoster(movie: MovieFixture): movie is MovieFixture & { poster_path: string } {
    return Boolean(movie.poster_path);
}

function formatPosterSubtitle(movie: MovieFixture) {
    const parts: string[] = [];
    const releaseYear = movie.release_date?.slice(0, 4);

    if (releaseYear) {
        parts.push(releaseYear);
    }
    if (Number.isFinite(movie.vote_average) && movie.vote_average > 0) {
        parts.push(`${movie.vote_average.toFixed(1)} IMDb`);
    }

    return parts.join(" • ");
}

export type MediaPoster = {
    color: string;
    id: string;
    imageUrl: string;
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

    return (rows as MediaRow[]).slice(0, MEDIA_RAIL_COUNT).map((row) => ({
        id: row.id,
        posters: (playlistMap[row.id] ?? []).filter(hasPoster).map((movie) => ({
            color: pickOne(mediaColors, random),
            id: `${row.id}-${movie.id}`,
            imageUrl: `${POSTER_BASE_URL}${movie.poster_path}`,
            subtitle: formatPosterSubtitle(movie),
            title: movie.title,
        })),
        title: row.title,
    })) satisfies MediaRail[];
}

export type VideoClip = {
    color: string;
    creator: string;
    id: string;
    title: string;
};

export function buildVideoFeed(count = 36) {
    const creators = ["Studio North", "Field Notes", "Signal Lab", "Open Frame"] as const;
    const random = createSeededRandom(31415);

    return Array.from({ length: count }, (_, index) => ({
        color: pickOne(mediaColors, random),
        creator: pickOne(creators, random),
        id: `clip-${index}`,
        title: `Clip ${index + 1}`,
    })) satisfies VideoClip[];
}
