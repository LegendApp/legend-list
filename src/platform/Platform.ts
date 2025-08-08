export const Platform = {
    isTesting: false,
    isTV: false,
    // Widen the type to avoid unreachable-branch lints in cross-platform code that compares against other OSes
    OS: "web" as "web" | "ios" | "android" | string,
    select: <T>(specifics: { web?: T; default?: T } & { [platform: string]: T }): T => {
        return specifics.web ?? specifics.default!;
    },
    Version: 0,
};
