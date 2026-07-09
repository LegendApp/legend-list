export type AppMode = "examples" | "fixtures";

export function getAppMode(): AppMode {
    return import.meta.env.VITE_LEGEND_LIST_MODE === "fixtures" ? "fixtures" : "examples";
}

export function isFixturesMode() {
    return getAppMode() === "fixtures";
}
