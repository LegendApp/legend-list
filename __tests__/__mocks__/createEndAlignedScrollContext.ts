import { createMockContext } from "./createMockContext";

export type RecordedScrollTo = { animated: boolean; x: number; y: number };

// 1000 items of ~401px with the last item at 394259 sized 441, so the content
// ends at 394700. With a 701px viewport the end-aligned target is 393999.
export function createEndAlignedScrollContext(
    scroll: number,
    scrollToCalls: RecordedScrollTo[],
    stateOverrides: Record<string, any> = {},
) {
    const data = Array.from({ length: 1000 }, (_, index) => ({ id: index }));
    const positions = Array.from({ length: 1000 }, (_, index) => index * 401);
    positions[999] = 394259;

    return createMockContext(
        { totalSize: 394700 },
        {
            didContainersLayout: true,
            hasScrolled: true,
            positions,
            props: {
                data,
                estimatedItemSize: 401,
            } as any,
            refScroller: {
                current: {
                    scrollTo: (params: RecordedScrollTo) => scrollToCalls.push(params),
                },
            } as any,
            scroll,
            scrollLength: 701,
            scrollPending: scroll,
            sizesKnown: new Map([["item_999", 441]]),
            ...stateOverrides,
        },
    );
}

export function createEndAlignedScrollTarget(animated: boolean) {
    return {
        animated,
        index: 999,
        offset: 397479,
        targetOffset: 397179,
        viewOffset: 0,
        viewPosition: 1,
    } as any;
}
