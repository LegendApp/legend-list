export type ScheduledWorkKey =
    | "adaptiveRender"
    | "checkFinishedScrollFallback"
    | "checkFinishedScrollFrame"
    | "checkFinishedScrollRetryFrame"
    | "fullDrawDistancePrewarm"
    | "ignoreScrollFromMVCP"
    | "imperativeScrollReady"
    | "mvcpRecalculate"
    | "platformScrollCompletion"
    | "preservedInitialScroll"
    | "renderRangeProjection";

type Work = [handle: any, cancel: (handle: any) => void];

export class ScheduledWork {
    private work = new Map<ScheduledWorkKey | ReturnType<typeof setTimeout>, Work>();

    timeout(callback: () => void, delay: number, key?: ScheduledWorkKey) {
        if (key) {
            this.cancel(key);
        }
        const work: Work = [undefined, clearTimeout];
        const handle = setTimeout(() => {
            const workKey = key ?? handle;
            if (this.work.get(workKey) === work) {
                this.work.delete(workKey);
                callback();
            }
        }, delay);
        work[0] = handle;
        this.work.set(key ?? handle, work);
    }

    frame(callback: () => void, key: ScheduledWorkKey) {
        this.cancel(key);
        const work: Work = [undefined, cancelAnimationFrame];
        this.work.set(key, work);
        work[0] = requestAnimationFrame(() => {
            if (this.work.get(key) === work) {
                this.work.delete(key);
                callback();
            }
        });
    }

    register(key: ScheduledWorkKey, cancel: () => void) {
        this.cancel(key);
        this.work.set(key, [undefined, cancel]);
    }

    cancel(key: ScheduledWorkKey) {
        const work = this.work.get(key);
        if (work) {
            this.work.delete(key);
            const [handle, cancel] = work;
            cancel(handle);
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
