export type AppMode = "examples" | "fixtures";

const APP_MODE_ENV = process.env.EXPO_PUBLIC_LEGEND_LIST_MODE;

export function getAppMode(): AppMode {
    return APP_MODE_ENV === "fixtures" ? "fixtures" : "examples";
}

export function isFixturesMode() {
    return getAppMode() === "fixtures";
}
