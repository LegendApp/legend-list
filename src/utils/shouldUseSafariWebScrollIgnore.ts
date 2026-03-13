export function shouldUseSafariWebScrollIgnore() {
    if (typeof navigator === "undefined") {
        return false;
    }

    const ua = navigator.userAgent || "";

    return (
        /AppleWebKit/i.test(ua) &&
        /Safari/i.test(ua) &&
        !/Android|Chrome|Chromium|CriOS|Edg|EdgiOS|OPR|OPT|Firefox|FxiOS/i.test(ua)
    );
}
