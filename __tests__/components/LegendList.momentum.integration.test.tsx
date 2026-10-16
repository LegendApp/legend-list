import { beforeEach, describe, expect, it, spyOn } from "bun:test";
import "../setup";

import * as React from "react";
import { Text } from "react-native";

import * as platformScroll from "../../src/core/doScrollTo";
import { doScrollTo as doNativeScrollTo } from "../../src/core/doScrollTo.native";
import type { LegendListRef } from "../../src/types.base";
import { act, render } from "../helpers/testingLibrary";

async function flushFrames() {
    for (let i = 0; i < 12; i++) {
        await act(async () => {
            await new Promise((resolve) => requestAnimationFrame(resolve));
        });
    }
}

// Stall recovery re-arms once when the JS thread delays its check, so the
// settle can land a window later than the stall timeout itself.
async function waitForWrites(writes: unknown[], timeoutMs = 3000) {
    const deadline = Date.now() + timeoutMs;
    while (writes.length === 0 && Date.now() < deadline) {
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 25));
        });
    }
    // Let any trailing writes from the settled follow land before asserting.
    await flushFrames();
}

async function mountFollowingList(listOptions?: { mvcpData?: boolean }) {
    const { LegendList } = await import("../../src/components/LegendList");
    const ref = React.createRef<LegendListRef>();
    let scrollProps: any;
    const writes: Array<{ animated: boolean; y: number }> = [];
    const events: string[] = [];
    // Keep the list, layout, follow scheduling, and gesture handlers real.
    // Substitute only the native view, recording its imperative scroll commands.
    const ScrollSurface = React.forwardRef(function MomentumScrollSurface(props: any, forwardedRef: React.Ref<any>) {
        scrollProps = props;
        React.useImperativeHandle(forwardedRef, () => ({
            measure: () => {},
            scrollTo: (options: { animated: boolean; y: number }) => writes.push(options),
        }));
        return <>{props.children}</>;
    });
    const list = (itemCount: number, prependCount = 0) => (
        <LegendList
            data={Array.from({ length: itemCount + prependCount }, (_, id) => ({ id: String(id - prependCount) }))}
            estimatedItemSize={50}
            getFixedItemSize={() => 50}
            keyExtractor={(item: { id: string }) => item.id}
            maintainScrollAtEnd
            maintainScrollAtEndThreshold={0.25}
            maintainVisibleContentPosition={listOptions?.mvcpData ? { data: true, size: true } : undefined}
            onMomentumScrollBegin={() => events.push("momentumBegin")}
            onMomentumScrollEnd={() => events.push("momentumEnd")}
            onScrollBeginDrag={() => events.push("dragBegin")}
            onScrollEndDrag={() => events.push("dragEnd")}
            recycleItems={false}
            ref={ref}
            renderItem={({ item }: { item: { id: string } }) => <Text>{item.id}</Text>}
            renderScrollComponent={(props: any) => <ScrollSurface {...props} />}
        />
    );
    let count = 20;
    let prepended = 0;
    const rendered = render(list(count));
    await flushFrames();
    act(() => scrollProps.onLayout({ nativeEvent: { layout: { height: 300, width: 300, x: 0, y: 0 } } }));
    await flushFrames();
    const event = (y: number) => ({
        nativeEvent: {
            contentOffset: { x: 0, y },
            contentSize: { height: (count + prepended) * 50, width: 300 },
            layoutMeasurement: { height: 300, width: 300 },
            velocity: { x: 0, y: -1 },
        },
        timeStamp: Date.now(),
    });
    const scroll = (y: number) => act(() => scrollProps.onScroll(event(y)));
    scroll(700);
    await flushFrames();
    expect(ref.current?.getState().isAtEnd).toBe(true);
    writes.length = 0;

    return {
        append: async () => {
            count++;
            rendered.rerender(list(count, prepended));
            await flushFrames();
        },
        beginDrag: () => act(() => scrollProps.onScrollBeginDrag(event(700))),
        beginMomentum: () => act(() => scrollProps.onMomentumScrollBegin(event(690))),
        endDrag: () => act(() => scrollProps.onScrollEndDrag(event(690))),
        endMomentum: () => act(() => scrollProps.onMomentumScrollEnd(event(ref.current!.getState().scroll))),
        events,
        // Prepending shifts the reader's offset through MVCP, so the growth is
        // already served and must not become settle-time follow credit.
        prepend: async (amount: number) => {
            prepended += amount;
            rendered.rerender(list(count, prepended));
            await flushFrames();
        },
        ref,
        scroll,
        unmount: rendered.unmount,
        writes,
    };
}

describe("native end following during momentum", () => {
    beforeEach(() => {
        // Bun resolves .ts by default; Metro resolves this dependency to .native.ts.
        spyOn(platformScroll, "doScrollTo").mockImplementation(doNativeScrollTo);
    });

    it("does not pull a flick back to the end when data arrives after finger release", async () => {
        const list = await mountFollowingList();
        list.beginDrag();
        list.scroll(690);
        list.endDrag();
        list.beginMomentum();
        await list.append();

        expect(list.writes).toEqual([]);
        // The flick continues beyond the follow threshold. Settling must not replay it.
        list.scroll(600);
        list.endMomentum();
        await flushFrames();
        expect(list.writes).toEqual([]);
        expect(list.events).toEqual(["dragBegin", "dragEnd", "momentumBegin", "momentumEnd"]);
        list.unmount();
    });

    it("suspends following when the drag reaches the end before momentum begins", async () => {
        const list = await mountFollowingList();
        list.beginDrag();
        list.scroll(690);
        list.scroll(700);
        list.endDrag();
        list.beginMomentum();
        await list.append();
        expect(list.writes).toEqual([]);
        list.scroll(600);
        list.endMomentum();
        await flushFrames();
        expect(list.writes).toEqual([]);
        list.unmount();
    });

    it("resumes deferred following only if the flick settles near the end", async () => {
        const list = await mountFollowingList();
        list.beginDrag();
        list.scroll(690);
        list.endDrag();
        list.beginMomentum();
        await list.append();
        expect(list.writes).toEqual([]);

        list.endMomentum();
        await flushFrames();
        expect(list.writes.map(({ y }) => y)).toEqual([750]);
        list.unmount();
    });

    it("does not treat programmatic momentum as a user flick", async () => {
        const list = await mountFollowingList();
        // A stationary drag can leave a pending momentum expectation. A later
        // explicit scroll owns its own native momentum events.
        list.beginDrag();
        list.endDrag();
        act(() => {
            void list.ref.current!.scrollToEnd({ animated: false });
        });
        await flushFrames();
        expect(list.writes.map(({ y }) => y)).toEqual([700]);
        list.scroll(700);
        await flushFrames();
        list.writes.length = 0;
        list.beginMomentum();
        await list.append();
        expect(list.writes.map(({ y }) => y)).toEqual([750]);
        list.endMomentum();
        expect(list.events).toEqual(["dragBegin", "dragEnd", "momentumBegin", "momentumEnd"]);
        list.unmount();
    });

    it("classifies a flick that interrupts an active programmatic scroll as user momentum", async () => {
        const list = await mountFollowingList();
        // Main cancels the animated request at drag start. The released drag
        // must still own subsequent native momentum and deferred following.
        act(() => {
            void list.ref.current!.scrollToOffset({ animated: true, offset: 400 });
        });
        await flushFrames();
        expect(list.writes.map(({ y }) => y)).toEqual([400]);
        list.writes.length = 0;

        // The user grabs the moving list and flicks back toward the end.
        list.beginDrag();
        list.scroll(500);
        list.endDrag();
        list.beginMomentum();
        await list.append();

        // Passing through the cancelled target must not resume following mid-flick.
        list.scroll(400);
        await flushFrames();
        expect(list.writes).toEqual([]);

        // The flick settles inside the end threshold, so the deferred follow
        // is recomputed against the final offset and runs exactly once.
        list.scroll(690);
        list.endMomentum();
        await flushFrames();
        expect(list.writes.map(({ y }) => y)).toEqual([750]);
        list.unmount();
    });

    it("suspends following from finger release until a flick begins", async () => {
        const list = await mountFollowingList();
        list.beginDrag();
        list.scroll(690);
        list.endDrag();
        // Rows arrive before the native momentum-begin event. The release must
        // already be treated as user momentum, not as an idle end follow.
        await list.append();
        expect(list.writes).toEqual([]);
        list.unmount();
    });

    it("resumes following when momentum never arrives after a release", async () => {
        const list = await mountFollowingList();
        list.beginDrag();
        list.scroll(690);
        list.endDrag();
        await list.append();
        expect(list.writes).toEqual([]);
        // Native can drop or never emit the momentum pair (for example a
        // stationary release on iOS, or a release at a clamped edge), so the
        // safety timeout must resume the deferred follow.
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 150));
        });
        expect(list.writes.map(({ y }) => y)).toEqual([750]);
        list.unmount();
    });

    it("recovers end following when momentum-end never arrives after a begin", async () => {
        const list = await mountFollowingList();
        list.beginDrag();
        list.scroll(690);
        list.endDrag();
        list.beginMomentum();
        await list.append();
        // The flick suspends following while it moves.
        expect(list.writes).toEqual([]);
        // Android can abort the fling at an edge and drop the momentum-end
        // event. With the native scroll silent past the stall window, the
        // flick must be considered settled and the deferred follow recomputed.
        await waitForWrites(list.writes);
        expect(list.writes.map(({ y }) => y)).toEqual([750]);
        // Ownership is fully released: the follow's own momentum completes and
        // a later append follows again without waiting for any gesture.
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 200));
        });
        list.writes.length = 0;
        await list.append();
        expect(list.writes.length).toBeGreaterThan(0);
        list.unmount();
    });

    it("keeps ownership across repeated momentum begins from a paging snap", async () => {
        const list = await mountFollowingList();
        list.beginDrag();
        list.scroll(690);
        list.endDrag();
        list.beginMomentum();
        // Android paging emits a second begin for its snap animator; ownership
        // must survive it, so the snap still suspends end following.
        list.beginMomentum();
        await list.append();
        expect(list.writes).toEqual([]);
        list.scroll(600);
        list.endMomentum();
        await flushFrames();
        expect(list.writes).toEqual([]);
        list.unmount();
    });

    it("attributes momentum arriving after the await timeout to the release", async () => {
        const list = await mountFollowingList();
        list.beginDrag();
        list.scroll(690);
        list.endDrag();
        // Let the safety timeout elapse with no follow dispatched in between,
        // then deliver a late momentum pair. Release provenance outlives the
        // suspension window, so the late flick is user-owned.
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 150));
        });
        list.beginMomentum();
        await list.append();
        expect(list.writes).toEqual([]);
        list.scroll(600);
        list.endMomentum();
        await flushFrames();
        expect(list.writes).toEqual([]);
        list.unmount();
    });
    it("follows content growth that arrived while the flick was in flight", async () => {
        const list = await mountFollowingList();
        list.beginDrag();
        list.scroll(690);
        list.endDrag();
        list.beginMomentum();
        // Two appends grow the content past the follow threshold (100px vs 75px)
        // while the flick is still in flight. The flick itself stays inside the
        // threshold, so the growth is the reader's own end-follow intent, not a
        // user move away from the end: settling must follow it.
        await list.append();
        await list.append();
        expect(list.writes).toEqual([]);
        list.endMomentum();
        await flushFrames();
        expect(list.writes.map(({ y }) => y)).toEqual([800]);
        list.unmount();
    });

    it("does not follow when the flick settles away from the end despite growth", async () => {
        const list = await mountFollowingList();
        list.beginDrag();
        list.scroll(690);
        list.endDrag();
        list.beginMomentum();
        await list.append();
        await list.append();
        // The flick itself ends 100px away from the end, beyond the threshold
        // even after discounting the growth. Settling must not steal that move.
        list.scroll(600);
        list.endMomentum();
        await flushFrames();
        expect(list.writes).toEqual([]);
        list.unmount();
    });

    it("does not credit growth that MVCP already carried the reader through", async () => {
        const list = await mountFollowingList({ mvcpData: true });
        // Standard chat-with-history: the reader scrolled 200px up from the end
        // and flicks upward while older messages prepend above them.
        list.scroll(500);
        await flushFrames();
        list.beginDrag();
        list.scroll(400);
        list.endDrag();
        list.beginMomentum();
        // 500px prepend: MVCP carries the reader through it, so the 500px of
        // growth leaves their 500px distance-from-end unchanged at settle.
        // Crediting it as unserved follow intent (500 - 500 <= 75 threshold)
        // would drag them to the end against a deliberate upward flick.
        await list.prepend(10);
        list.scroll(700);
        list.endMomentum();
        await flushFrames();
        expect(list.writes).toEqual([]);
        list.unmount();
    });

    it("follows after a cancelled request and a near-end momentum settle", async () => {
        const list = await mountFollowingList();
        act(() => {
            void list.ref.current!.scrollToOffset({ animated: true, offset: 400 });
        });
        await flushFrames();
        list.writes.length = 0;
        // Interrupt the request and settle inside the end threshold without
        // ever reaching its target, so nothing else can finish it.
        list.beginDrag();
        list.scroll(650);
        list.endDrag();
        list.beginMomentum();
        await list.append();
        list.scroll(690);
        list.endMomentum();
        await flushFrames();
        // The cancelled request cannot block the deferred follow.
        expect(list.writes.map(({ y }) => y)).toEqual([750]);
        list.unmount();
    });

    it("follows after a cancelled request and a stationary release", async () => {
        const list = await mountFollowingList();
        act(() => {
            void list.ref.current!.scrollToOffset({ animated: true, offset: 400 });
        });
        await flushFrames();
        list.writes.length = 0;
        list.beginDrag();
        list.scroll(690);
        list.endDrag();
        await list.append();
        expect(list.writes).toEqual([]);
        // No momentum pair arrives; the bounded release window resumes following.
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 150));
        });
        expect(list.writes.map(({ y }) => y)).toEqual([750]);
        list.unmount();
    });

    it("follows after a cancelled request and dropped momentum-end", async () => {
        const list = await mountFollowingList();
        act(() => {
            void list.ref.current!.scrollToOffset({ animated: true, offset: 400 });
        });
        await flushFrames();
        list.writes.length = 0;
        list.beginDrag();
        list.scroll(650);
        list.endDrag();
        list.beginMomentum();
        list.scroll(690);
        await list.append();
        expect(list.writes).toEqual([]);
        // Dropped momentum-end recovery must resume the deferred follow.
        await waitForWrites(list.writes);
        expect(list.writes.map(({ y }) => y)).toEqual([750]);
        list.unmount();
    });
});
