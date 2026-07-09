export const Platform = {
    // Widen the type to avoid unreachable-branch lints in cross-platform code that compares against other OSes
    OS: "web" as "web" | "ios" | "android",
};

export const PlatformAdjustBreaksScroll = true;
