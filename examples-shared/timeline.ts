import { createSeededRandom, pickOne } from "./random";

export type TimelineEntryKind = "event" | "message" | "photo" | "task";

export type TimelineEntry = {
    id: string;
    kind: TimelineEntryKind;
    meta: string;
    title: string;
};

export const TIMELINE_KINDS: readonly TimelineEntryKind[] = ["message", "task", "event", "photo"] as const;

export const TIMELINE_KIND_COLORS: Record<TimelineEntryKind, string> = {
    event: "#2A9D8F",
    message: "#3D5A80",
    photo: "#6D597A",
    task: "#E76F51",
};

export const TIMELINE_KIND_LABELS: Record<TimelineEntryKind, string> = {
    event: "Event",
    message: "Message",
    photo: "Photo",
    task: "Task",
};

const titles: Record<TimelineEntryKind, readonly string[]> = {
    event: ["Design review", "Release train", "Retro", "Roadmap sync", "Support rotation"],
    message: ["Asked about the rollout", "Left feedback", "Replied in the thread", "Shared an update"],
    photo: ["Booth photos", "Office move", "Onsite whiteboard", "Team offsite"],
    task: ["Audit list metrics", "Fix separator spacing", "Ship recycling fix", "Triage regressions"],
};

const people = ["Avery", "Devon", "Harper", "Jordan", "Kai", "Morgan", "Parker", "Riley", "Sawyer", "Skyler"] as const;

const hours = ["08:15", "09:40", "11:05", "13:20", "15:45", "17:30"] as const;

export function buildTimelineEntries(count = 80): TimelineEntry[] {
    const random = createSeededRandom(17);
    const entries: TimelineEntry[] = [];
    let kindIndex = 0;
    let remainingInRun = 0;

    for (let index = 0; index < count; index++) {
        if (remainingInRun === 0) {
            // Runs of one to three entries, so the list has both same-kind and cross-kind boundaries.
            remainingInRun = 1 + Math.floor(random() * 3);
            kindIndex = (kindIndex + 1) % TIMELINE_KINDS.length;
        }
        remainingInRun--;

        const kind = TIMELINE_KINDS[kindIndex]!;
        entries.push({
            id: `entry-${index + 1}`,
            kind,
            meta: `${pickOne(people, random)} · ${pickOne(hours, random)}`,
            title: pickOne(titles[kind], random),
        });
    }

    return entries;
}

export function nextTimelineKind(kind: TimelineEntryKind): TimelineEntryKind {
    return TIMELINE_KINDS[(TIMELINE_KINDS.indexOf(kind) + 1) % TIMELINE_KINDS.length]!;
}

export function cycleTimelineEntryKind(entries: TimelineEntry[], id: string): TimelineEntry[] {
    return entries.map((entry) => (entry.id === id ? { ...entry, kind: nextTimelineKind(entry.kind) } : entry));
}
