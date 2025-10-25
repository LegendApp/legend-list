let globalResizeObserver: ResizeObserver | null = null;

function getGlobalResizeObserver(): ResizeObserver {
    if (!globalResizeObserver) {
        globalResizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const callbacks = callbackMap.get(entry.target);
                if (callbacks) {
                    for (const callback of callbacks) {
                        callback(entry);
                    }
                }
            }
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
        const callbacks = callbackMap.get(element);
        if (callbacks) {
            callbacks.delete(callback);
            if (callbacks.size === 0) {
                callbackMap.delete(element);
                observer.unobserve(element);
            }
        }
    };
}
