export type ScheduledWorkKey =
    | "adaptiveRender"
    | "checkFinishedScrollFallback"
    | "checkFinishedScrollFrame"
    | "fullDrawDistancePrewarm"
    | "ignoreScrollFromMVCP"
    | "mvcpRecalculate"
    | "preservedInitialScroll"
    | "renderRangeProjection";

type Work = [handle: any, cancel: (handle: any) => void];

export class ScheduledWork {
    private work = new Map<ScheduledWorkKey | ReturnType<typeof setTimeout>, Work>();

    timeout(callback: () => void, delay: number, key?: ScheduledWorkKey) {
        if (key) {
            this.cancel(key);
        }
        const handle = setTimeout(() => {
            this.work.delete(key ?? handle);
            callback();
        }, delay);
        this.work.set(key ?? handle, [handle, clearTimeout]);
    }

    frame(callback: () => void, key: ScheduledWorkKey) {
        this.cancel(key);
        const handle = requestAnimationFrame(() => {
            this.work.delete(key);
            callback();
        });
        this.work.set(key, [handle, cancelAnimationFrame]);
    }

    cancel(key: ScheduledWorkKey) {
        const work = this.work.get(key);
        if (work) {
            this.work.delete(key);
            work[1](work[0]);
        }
    }

    has(key: ScheduledWorkKey) {
        return this.work.has(key);
    }

    dispose() {
        for (const [handle, cancel] of this.work.values()) {
            cancel(handle);
        }
        this.work.clear();
    }
}
