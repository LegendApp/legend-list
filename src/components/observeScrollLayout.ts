import { type ExternalScrollTarget, isWindowTarget } from "./webScrollUtils";

/** Track the viewport and content that can move a list within its scroll owner. */
export function observeScrollLayout(element: HTMLElement, owner: ExternalScrollTarget, onLayout: () => void) {
    if (owner === null) return;

    const resizeObserver = new ResizeObserver(onLayout);
    const mutationObserver = owner === undefined ? undefined : new MutationObserver(observe);

    function observe() {
        resizeObserver.disconnect();
        mutationObserver?.disconnect();
        resizeObserver.observe(element);

        if (owner !== undefined) {
            // Observe only ancestor child lists, not recycled rows or live row text.
            // Rebind when preceding sections mount, unmount, or are replaced.
            for (let node: Element | null = element; node && node !== owner; node = node.parentElement) {
                const parent = node.parentElement;
                if (parent) {
                    resizeObserver.observe(parent);
                    mutationObserver?.observe(parent, { childList: true });
                }
                for (let sibling = node.previousElementSibling; sibling; sibling = sibling.previousElementSibling) {
                    resizeObserver.observe(sibling);
                }
            }
        }
        onLayout();
    }

    observe();
    if (isWindowTarget(owner)) owner.addEventListener("resize", onLayout);
    return () => {
        resizeObserver.disconnect();
        mutationObserver?.disconnect();
        if (isWindowTarget(owner)) owner.removeEventListener("resize", onLayout);
    };
}
