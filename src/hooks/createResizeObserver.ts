let globalResizeObserver: ResizeObserver | null = null;

function getGlobalResizeObserver(): ResizeObserver {
    if (!globalResizeObserver) {
        let pending: ResizeObserverEntry[] = [];
        let timer: ReturnType<typeof setTimeout> | null = null;
        globalResizeObserver = new ResizeObserver((entries) => {
            pending = pending.concat(entries);
            clearTimeout(timer!);
            timer = setTimeout(() => {
                const toProcess = pending;
                pending = [];
                timer = null;
                for (const entry of toProcess) {
                    const callbacks = callbackMap.get(entry.target);
                    if (callbacks) {
                        for (const callback of callbacks) {
                            callback(entry);
                        }
                    }
                }
            }, 0);
        });
    }
    return globalResizeObserver;
}

const callbackMap = new WeakMap<Element, Set<(entry: ResizeObserverEntry) => void>>();

export function createResizeObserver(
    element: Element | null,
    callback: (entry: ResizeObserverEntry) => void,
): () => void {
    if (typeof ResizeObserver === "undefined") {
        // Tests and native environments without a DOM don't expose ResizeObserver.
        return () => {};
    }

    if (!element) {
        return () => {};
    }

    const observer = getGlobalResizeObserver();

    let callbacks = callbackMap.get(element);
    if (!callbacks) {
        callbacks = new Set();
        callbackMap.set(element, callbacks);
        observer.observe(element);
    }

    callbacks.add(callback);

    return () => {
        if (callbacks) {
            callbacks.delete(callback);
            if (callbacks.size === 0) {
                callbackMap.delete(element);
                observer.unobserve(element);
            }
        }
    };
}
