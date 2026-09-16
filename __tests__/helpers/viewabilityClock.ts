import { spyOn } from "bun:test";
import type { ScheduledWork, ScheduledWorkKey } from "../../src/core/ScheduledWork";

// Control only viewability deadlines. React and layout scheduling keep their real
// clocks, while cancellation and replacement retain the production keyed semantics.
export function createViewabilityClock(work: ScheduledWork) {
    let now = 0;
    const pending = new Map<ScheduledWorkKey, { at: number; callback: () => void }>();
    const originalTimeout = work.timeout.bind(work);
    const originalCancel = work.cancel.bind(work);
    const date = spyOn(Date, "now").mockImplementation(() => now);
    const cancel = spyOn(work, "cancel").mockImplementation((key) => {
        pending.delete(key);
        originalCancel(key);
    });
    const timeout = spyOn(work, "timeout").mockImplementation((callback, delay, key) => {
        if (key?.startsWith("viewability:")) {
            originalCancel(key);
            pending.set(key, { at: now + delay, callback });
        } else {
            originalTimeout(callback, delay, key);
        }
    });
    return {
        advance(target: number) {
            while (true) {
                const next = [...pending].sort((a, b) => a[1].at - b[1].at)[0];
                if (!next || next[1].at > target) break;
                now = next[1].at;
                pending.delete(next[0]);
                next[1].callback();
            }
            now = target;
        },
        pending,
        restore() {
            pending.clear();
            timeout.mockRestore();
            cancel.mockRestore();
            date.mockRestore();
        },
    };
}
