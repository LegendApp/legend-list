import { describe, expect, it, spyOn } from "bun:test";
import "../setup";

import { useThrottledOnScroll } from "../../src/utils/throttledOnScroll";
import TestRenderer, { act } from "../helpers/testRenderer";
import { installFakeClock } from "../helpers/webScrollHarness";

type ScrollHandler = NonNullable<ReturnType<typeof useThrottledOnScroll>>;

function renderHandler(initialCallback: ScrollHandler, initialDelay: number) {
    let handler!: ScrollHandler;
    function Probe({ callback, delay }: { callback: ScrollHandler; delay: number }) {
        handler = useThrottledOnScroll(callback, delay)!;
        return null;
    }

    let renderer!: ReturnType<typeof TestRenderer.create>;
    act(() => {
        renderer = TestRenderer.create(<Probe callback={initialCallback} delay={initialDelay} />);
    });
    return {
        emit(y: number) {
            handler({ nativeEvent: { contentOffset: { x: 0, y } } } as Parameters<typeof handler>[0]);
        },
        unmount: () => act(() => renderer.unmount()),
        update(callback: ScrollHandler, delay: number) {
            act(() => renderer.update(<Probe callback={callback} delay={delay} />));
        },
    };
}

describe("useThrottledOnScroll", () => {
    it("keeps one timer and delivers the latest event to the latest handler", () => {
        const clock = installFakeClock();
        const now = spyOn(Date, "now").mockImplementation(() => 1_000 + clock.now);
        const schedule = spyOn(globalThis, "setTimeout");
        const calls: number[] = [];
        const scroll = renderHandler((event) => calls.push(event.nativeEvent.contentOffset.y), 16);
        try {
            schedule.mockClear();
            scroll.emit(1);
            clock.advance(4);
            scroll.emit(2);
            clock.advance(4);
            scroll.update((event) => calls.push(event.nativeEvent.contentOffset.y * 10), 16);
            scroll.emit(3);
            clock.advance(4);
            scroll.emit(4);

            expect(calls).toEqual([1]);
            expect(schedule).toHaveBeenCalledTimes(1);
            clock.advance(4);
            expect(calls).toEqual([1, 40]);
        } finally {
            scroll.unmount();
            schedule.mockRestore();
            now.mockRestore();
            clock.restore();
        }
    });

    it.each([16, 64])("uses the new %dms interval for the next trailing event", (interval) => {
        const clock = installFakeClock();
        const now = spyOn(Date, "now").mockImplementation(() => 1_000 + clock.now);
        const calls: number[] = [];
        const callback: ScrollHandler = (event) => calls.push(event.nativeEvent.contentOffset.y);
        const scroll = renderHandler(callback, 32);
        try {
            scroll.emit(1);
            clock.advance(4);
            scroll.emit(2);
            clock.advance(4);
            scroll.update(callback, interval);
            scroll.emit(3);

            clock.advance(interval - 9);
            expect(calls).toEqual([1]);
            clock.advance(1);
            expect(calls).toEqual([1, 3]);
        } finally {
            scroll.unmount();
            now.mockRestore();
            clock.restore();
        }
    });

    it("lets a fresh leading event replace a trailing timer that has not run by its deadline", () => {
        const clock = installFakeClock();
        const now = spyOn(Date, "now").mockImplementation(() => 1_000 + clock.now);
        const calls: number[] = [];
        const scroll = renderHandler((event) => calls.push(event.nativeEvent.contentOffset.y), 16);
        try {
            scroll.emit(1);
            clock.advance(4);
            scroll.emit(2);
            requestAnimationFrame(() => {
                scroll.emit(3);
                expect(calls).toEqual([1, 3]);
            });
            clock.tick(20);
            scroll.emit(4);
            expect(calls).toEqual([1, 3]);
            clock.advance(16);
            expect(calls).toEqual([1, 3, 4]);
        } finally {
            scroll.unmount();
            now.mockRestore();
            clock.restore();
        }
    });

    it("drops the event queued by a trailing callback when that callback unmounts the listener", () => {
        const clock = installFakeClock();
        const now = spyOn(Date, "now").mockImplementation(() => 1_000 + clock.now);
        const calls: number[] = [];
        const scroll = renderHandler((event) => {
            const { y } = event.nativeEvent.contentOffset;
            calls.push(y);
            if (y === 2) {
                scroll.emit(3);
                scroll.unmount();
            }
        }, 16);
        try {
            scroll.emit(1);
            clock.advance(4);
            scroll.emit(2);
            clock.advance(32);

            expect(calls).toEqual([1, 2]);
        } finally {
            scroll.unmount();
            now.mockRestore();
            clock.restore();
        }
    });
});
