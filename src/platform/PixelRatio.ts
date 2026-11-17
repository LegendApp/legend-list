export const PixelRatio = {
    get() {
        // Guard for SSR
        if (typeof window === "undefined" || !window.devicePixelRatio) {
            return 1;
        }
        return window.devicePixelRatio;
    },
};
