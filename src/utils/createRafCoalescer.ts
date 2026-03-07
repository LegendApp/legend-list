export function createRafCoalescer(
    callback: () => void,
    raf?: typeof requestAnimationFrame,
    cancelRaf?: typeof cancelAnimationFrame,
) {
    let rafId: number | undefined;

    const getRaf = () => raf ?? globalThis.requestAnimationFrame;
    const getCancelRaf = () => cancelRaf ?? globalThis.cancelAnimationFrame;

    return {
        cancel() {
            if (rafId !== undefined) {
                getCancelRaf()?.(rafId);
                rafId = undefined;
            }
        },
        schedule() {
            if (rafId !== undefined) {
                return false;
            }

            const scheduleRaf = getRaf();
            if (!scheduleRaf) {
                callback();
                return true;
            }

            rafId = scheduleRaf(() => {
                rafId = undefined;
                callback();
            });

            return true;
        },
    };
}
