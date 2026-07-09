export function getWindowSize() {
    if (typeof window === "undefined") {
        return { height: 0, width: 0 };
    }

    return {
        height: window.innerHeight,
        width: window.innerWidth,
    };
}
