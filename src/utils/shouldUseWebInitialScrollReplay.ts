export function shouldUseWebInitialScrollReplay() {
    if (typeof navigator === "undefined") {
        return false;
    }

    const ua = navigator.userAgent || "";
    const isAppleWebKit = /AppleWebKit/i.test(ua);
    const isAndroid = /Android/i.test(ua);
    const isChromeLike = /Chrome|CriOS|Edg|OPR|SamsungBrowser|DuckDuckGo/i.test(ua);
    const isSafari = /Safari/i.test(ua) && !isChromeLike;

    if (!isAppleWebKit || isAndroid) {
        return false;
    }

    // Safari on Apple WebKit, including desktop Safari, still needs the explicit
    // post-finish replay to converge from estimated initial offsets to measured layout.
    return isSafari;
}
