type ContainerLayoutSize = Pick<DOMRectReadOnly, "height" | "width">;

// This tracks the physical border box read by the parent layout effect. It is
// intentionally separate from sizesKnown, which stores item scroll-axis sizes.
const containerLayoutBaselines = new WeakMap<HTMLElement, ContainerLayoutSize>();

export function getContainerLayoutBaseline(element: HTMLElement): ContainerLayoutSize | undefined {
    return containerLayoutBaselines.get(element);
}

export function setContainerLayoutBaseline(element: HTMLElement, size: ContainerLayoutSize) {
    containerLayoutBaselines.set(element, size);
}

// Measures the layout border box, as ResizeObserver reports it. getBoundingClientRect also applies
// ancestor transforms, such as a dialog scaling in, which item positions must not include.
export function measureContainerLayoutSize(element: HTMLElement): ContainerLayoutSize {
    const rect = element.getBoundingClientRect();
    // offsetWidth/offsetHeight round the layout box; a larger difference means a transform.
    if (Math.abs(rect.width - element.offsetWidth) >= 1 || Math.abs(rect.height - element.offsetHeight) >= 1) {
        const style = getComputedStyle(element);
        const height = Number.parseFloat(style.height);
        const width = Number.parseFloat(style.width);
        if (Number.isFinite(height) && Number.isFinite(width)) return { height, width };
    }
    return rect;
}
