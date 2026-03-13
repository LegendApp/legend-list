export function shouldUseWebInitialScrollReplay() {
    if (typeof navigator === "undefined") {
        return false;
    }

    const ua = navigator.userAgent || "";
    const maxTouchPoints = navigator.maxTouchPoints || 0;

    if (maxTouchPoints <= 0) {
        return false;
    }

    // Restrict the replay workaround to touch Apple WebKit browsers. Desktop browsers
    // continue using the normal web MVCP path, while iPhone/iPad Safari and WKWebView
    // keep the explicit initial-scroll replay that avoids the upward staircase.
    return /AppleWebKit/i.test(ua) && !/Android/i.test(ua);
}
