import { afterEach, expect, it } from "bun:test";
import "../setup";

import * as React from "react";

import { Platform } from "../../src/platform/Platform";
import { peek$, useStateContext } from "../../src/state/state";
import { act, render } from "../helpers/testingLibrary";
import { installFakeClock } from "../helpers/webScrollHarness";

const originalOS = Platform.OS;
afterEach(() => {
    Platform.OS = originalOS;
});

it("pools only the containers in use until the post-paint widen adds the spare", async () => {
    Platform.OS = "ios";
    const clock = installFakeClock();
    let ctx!: ReturnType<typeof useStateContext>;
    let rowsThisCommit = 0;
    const commits: { pooled: number; rows: number; used: number }[] = [];

    function Row() {
        React.useLayoutEffect(() => {
            rowsThisCommit++;
        });
        return null;
    }
    function Surface({ children, ref }: any) {
        ctx = useStateContext();
        const viewRefs = ctx.viewRefs as typeof ctx.viewRefs & { measured?: boolean };
        if (!viewRefs.measured) {
            viewRefs.measured = true;
            const set = viewRefs.set.bind(viewRefs);
            viewRefs.set = (id: number, viewRef: any) => {
                Object.defineProperty(viewRef, "current", {
                    get: () => ({ measure: (cb: any) => cb(0, 0, 390, ctx.state.props.estimatedItemSize) }),
                    set: () => {},
                });
                return set(id, viewRef);
            };
        }
        React.useImperativeHandle(ref, () => ({
            getCurrentScrollOffset: () => 0,
            getScrollableNode: () => ({}),
            measure: (cb: any) => cb(0, 0, 390, 852),
            scrollTo: () => {},
        }));
        return <>{children}</>;
    }
    const { LegendList } = await import("../../src/components/LegendList?spare-pool");
    const el = (prefix: string, estimatedItemSize: number) => (
        <React.Profiler
            id="list"
            onRender={() => {
                commits.push({
                    pooled: peek$(ctx, "numContainersPooled") ?? 0,
                    rows: rowsThisCommit,
                    used: peek$(ctx, "numContainers"),
                });
                rowsThisCommit = 0;
            }}
        >
            <LegendList
                data={Array.from({ length: 60 }, (_, i) => `${prefix}${i}`)}
                estimatedItemSize={estimatedItemSize}
                estimatedListSize={{ height: 852, width: 390 }}
                keyExtractor={(item: string) => item}
                recycleItems
                renderItem={() => <Row />}
                renderScrollComponent={(props: any) => <Surface {...props} />}
            />
        </React.Profiler>
    );
    let r: ReturnType<typeof render> | undefined;
    try {
        act(() => {
            r = render(el("a", 64));
        });
        // The first rows mount in the same commits as before, without 30 spare slots beside them.
        expect(commits.slice(0, 2)).toEqual([
            { pooled: 15, rows: 0, used: 15 },
            { pooled: 15, rows: 15, used: 15 },
        ]);

        // A data commit before the widen mounts only the slots its range needs.
        act(() => {
            r!.rerender(el("b", 32));
        });
        const used = peek$(ctx, "numContainers");
        expect(used).toBeGreaterThan(15);
        expect(peek$(ctx, "numContainersPooled")).toBe(used);

        // The post-paint widen adds the spare slots.
        act(() => {
            clock.advance(200);
        });
        expect(peek$(ctx, "numContainersPooled")).toBe(60);
    } finally {
        r?.unmount();
        clock.restore();
    }
});
