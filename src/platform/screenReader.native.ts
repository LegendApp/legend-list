import { AccessibilityInfo } from "react-native";

let enabled = false;
let subscribers = 0;
let subscription: ReturnType<typeof AccessibilityInfo.addEventListener> | undefined;

export const isScreenReaderEnabled = () => enabled;

// The setting is read by scroll handlers, so no React updates or per-list listeners are needed.
export function subscribeScreenReader() {
    if (subscribers++ === 0) {
        let changed = false;
        const current = AccessibilityInfo.addEventListener("screenReaderChanged", (value) => {
            changed = true;
            enabled = value;
        });
        subscription = current;
        void AccessibilityInfo.isScreenReaderEnabled().then((value) => {
            if (subscription === current && !changed) enabled = value;
        });
    }
    return () => {
        if (--subscribers === 0) {
            subscription?.remove();
            subscription = undefined;
            enabled = false;
        }
    };
}
