export type ScheduledWorkKey =
    | "adaptiveRender"
    | "alignItemsAtEndPaddingFallback"
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

interface Work {
    callback?: () => void;
    cancel: () => void;
}

export class ScheduledWork {
    private work = new Map<ScheduledWorkKey | ReturnType<typeof setTimeout>, Work>();

    microtask(callback: () => void, key: ScheduledWorkKey) {
        const pendingWork = this.work.get(key);
        if (pendingWork?.callback) {
            pendingWork.callback = callback;
        } else {
            this.cancel(key);
            const work: Work = { callback, cancel: () => {} };
            this.work.set(key, work);
            queueMicrotask(() => {
                if (this.work.get(key) === work) {
                    this.work.delete(key);
                    work.callback?.();
                }
            });
        }
    }

    timeout(callback: () => void, delay: number, key?: ScheduledWorkKey) {
        if (key) {
            this.cancel(key);
        }
        const work: Work = { cancel: () => clearTimeout(handle) };
        const handle = setTimeout(() => {
            const workKey = key ?? handle;
            if (this.work.get(workKey) === work) {
                this.work.delete(workKey);
                callback();
            }
        }, delay);
        this.work.set(key ?? handle, work);
    }

    frame(callback: () => void, key: ScheduledWorkKey) {
        this.cancel(key);
        const work: Work = { cancel: () => cancelAnimationFrame(handle) };
        this.work.set(key, work);
        const handle = requestAnimationFrame(() => {
            if (this.work.get(key) === work) {
                this.work.delete(key);
                callback();
            }
        });
    }

    register(key: ScheduledWorkKey, cancel: () => void) {
        this.cancel(key);
        this.work.set(key, { cancel });
    }

    cancel(key: ScheduledWorkKey) {
        const work = this.work.get(key);
        if (work) {
            this.work.delete(key);
            work.cancel();
        }
    }

    has(key: ScheduledWorkKey) {
        return this.work.has(key);
    }

    dispose() {
        for (const work of this.work.values()) {
            work.cancel();
        }
        this.work.clear();
    }
}
