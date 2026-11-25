import { afterEach, expect, it } from "bun:test";
import "../setup";

import * as React from "react";

import { Platform } from "../../src/platform/Platform";
import { peek$, useStateContext } from "../../src/state/state";
import { act, render } from "../helpers/testingLibrary";
import { installFakeClock } from "../helpers/webScrollHarness";

const VIEW = 600;
const SIZE = 60;
const originalOS = Platform.OS;

afterEach(() => {
    Platform.OS = originalOS;
});

it("reveals the first rows unchanged and widens the draw distance in steps only after they had time to paint", async () => {
    Platform.OS = "ios";
    const clock = installFakeClock();
    let ctx!: ReturnType<typeof useStateContext>;
    const mountedRows = new Set<string>();
    let rowsThisCommit = 0;
    const commits: number[] = [];

    function Row({ item }: { item: string }) {
        React.useLayoutEffect(() => {
            mountedRows.add(item);
            rowsThisCommit++;
            return () => {
                mountedRows.delete(item);
            };
        }, [item]);
        return null;
    }

    // Fabric measures synchronously in layout effects.
    function Surface({ children, ref }: any) {
        ctx = useStateContext();
        const viewRefs = ctx.viewRefs;
        if (!(viewRefs as any).__measured) {
            (viewRefs as any).__measured = true;
            const set = viewRefs.set.bind(viewRefs);
            viewRefs.set = (id: number, viewRef: any) => {
                Object.defineProperty(viewRef, "current", {
                    get: () => ({ measure: (cb: any) => cb(0, 0, 300, SIZE) }),
                    set: () => {},
                });
                return set(id, viewRef);
            };
        }
        React.useImperativeHandle(ref, () => ({
            getCurrentScrollOffset: () => 0,
            getScrollableNode: () => ({}),
            measure: (cb: any) => cb(0, 0, 300, VIEW),
            scrollTo: () => {},
        }));
        return <>{children}</>;
    }

    const { LegendList } = await import("../../src/components/LegendList?prewarm-after-paint");
    const data = Array.from({ length: 200 }, (_, i) => String(i));
    let renderer: ReturnType<typeof render> | undefined;
    try {
        act(() => {
            renderer = render(
                <React.Profiler
                    id="list"
                    onRender={() => {
                        commits.push(rowsThisCommit);
                        rowsThisCommit = 0;
                    }}
                >
                    <LegendList
                        data={data}
                        drawDistance={VIEW * 2}
                        estimatedItemSize={SIZE}
                        keyExtractor={(item: string) => item}
                        renderItem={({ item }: { item: string }) => <Row item={item} />}
                        renderScrollComponent={(props: any) => <Surface {...props} />}
                    />
                </React.Profiler>,
            );
        });

        // The first rows reveal in the second commit of the mount task, as in 3.9.1.
        expect(peek$(ctx, "readyToRender")).toBe(true);
        expect(commits.slice(0, 2)).toEqual([0, 12]);
        expect(mountedRows.size).toBe(12);

        await act(async () => {
            clock.tick(16);
            await Promise.resolve();
        });
        expect(mountedRows.size).toBe(12);

        await act(async () => {
            clock.advance(100);
            await Promise.resolve();
        });
        // The widen then steps across frames, about one viewport of rows per commit.
        let frames = 0;
        while (mountedRows.size < 52 && frames < 10) {
            await act(async () => {
                clock.tick(16);
                await Promise.resolve();
            });
            frames++;
        }
        expect(Math.max(...commits.slice(2))).toBeLessThanOrEqual(12);
        expect(frames).toBeLessThanOrEqual(4);
        expect(mountedRows.size).toBe(52);
    } finally {
        renderer?.unmount();
        clock.restore();
    }
});
