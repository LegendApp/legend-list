import { expect, it, spyOn } from "bun:test";
import "../setup";

import * as platformScroll from "../../src/core/doScrollTo";
import { doScrollTo as doNativeScrollTo } from "../../src/core/doScrollTo.native";
import { Empty, mountList, positions } from "./LegendList.showImmediately.cases";

it("mounts visible fixed rows at their final positions before Fabric layout", async () => {
    const list = await mountList("ios");
    try {
        list.mount();
        expect(list.firstCommit()).toEqual(positions(0, 3));
        expect(list.state().lastLayout).toBeUndefined();
        expect(JSON.stringify(list.tree())).toContain('"opacity":1');
        list.layout(0);
        expect(list.state().lastLayout).toBeUndefined();
        expect(list.rows()).toEqual(list.firstCommit());
        list.layout(150);
        expect(list.rows()).toEqual(list.firstCommit());
        expect(list.scrollWrites).toEqual([]);
    } finally {
        list.unmount();
    }
});

it.each([undefined, false])(
    "waits for Fabric layout with fixed sizes when showImmediately is %s",
    async (showImmediately) => {
        const list = await mountList("ios", { showImmediately });
        try {
            list.mount();
            expect(list.firstCommit()).toEqual([]);
            expect(list.state().hasEstimatedInitialLayout).toBe(false);
            list.layout(150);
            expect(list.rows()).toEqual(positions(0, 3));
            expect(list.scrollWrites).toEqual([]);
        } finally {
            list.unmount();
        }
    },
);

it.each([75, 275])("corrects the Fabric range after measuring %d", async (estimatedHeight) => {
    const list = await mountList("ios", {
        estimatedListSize: { height: estimatedHeight, width: 250 },
        maintainVisibleContentPosition: true,
    });
    try {
        list.mount();
        expect(list.firstCommit()).toEqual(positions(0, Math.floor(estimatedHeight / 50)));
        list.layout(150);
        expect(list.renderedRange()).toEqual([0, 3]);
        const committed = positions(0, Math.max(3, Math.floor(estimatedHeight / 50)));
        expect(list.rows()).toEqual(committed);
        expect(list.scrollWrites).toEqual([]);
    } finally {
        list.unmount();
    }
});

it("uses the window width for a horizontal Fabric list", async () => {
    const list = await mountList("ios", { estimatedListSize: undefined, horizontal: true });
    try {
        list.mount();
        expect(list.firstCommit()).toEqual(positions(0, 7));
        list.layout(150);
        expect(list.renderedRange()).toEqual([0, 3]);
        expect(list.rows()).toEqual(positions(0, 7));
    } finally {
        list.unmount();
    }
});

it("mounts rows around the initial index on the first Fabric commit", async () => {
    const list = await mountList("ios", { initialScrollIndex: 10 });
    try {
        list.mount();
        expect(list.firstCommit()).toEqual(positions(10, 13));
        expect(list.offset()).toBe(500);
        list.layout(150);
        list.tick();
        expect(list.rows()).toEqual(positions(10, 13));
        expect(list.offset()).toBe(500);
    } finally {
        list.unmount();
    }
});

it("retries a measured initial index with viewOffset before revealing it", async () => {
    spyOn(platformScroll, "doScrollTo").mockImplementation(doNativeScrollTo);
    const list = await mountList("ios", {
        data: Array.from({ length: 10 }, (_, index) => String(index)),
        drawDistance: 300,
        estimatedItemSize: 50,
        getFixedItemSize: undefined,
        initialScrollIndex: { index: 4, viewOffset: 13, viewPosition: 0.5 },
        showImmediately: false,
    });
    try {
        list.mount();
        const seed = list.offset();
        expect(seed).toBe(137);
        list.layout(150);
        expect(list.nativeContentStyle()?.opacity).toBe(0);
        expect(list.scrollWrites).toEqual([]);

        const heights = [40, 70, 55, 65, 90, 60, 45, 70, 60, 50];
        list.measureRows((key) => heights[Number(key)]);
        for (let frame = 0; frame < 6 && !list.scrollWrites.length; frame++) list.tick();
        // Row 4 starts at 230. Centering a 90px row in 150px leaves 30px, plus the 13px viewOffset.
        expect(list.scrollWrites).toEqual([187]);
        list.emitScroll(seed);
        list.tick();
        const writesBeforeResize = list.scrollWrites.length;
        list.measureRows((key) => (key === "4" ? 130 : undefined));

        for (let frame = 0; frame < 8 && list.scrollWrites.length === writesBeforeResize; frame++) list.tick();
        expect(list.scrollWrites.slice(writesBeforeResize)).toEqual([207]);
        expect(list.nativeContentStyle()?.opacity).toBe(0);
        list.emitScroll(list.offset());
        list.tick();

        expect(list.nativeContentStyle()?.opacity).toBe(1);
        expect(list.state().scroll).toBe(207);
        expect(list.state().sizesKnown.get("4")).toBe(130);
        const targetTop = list.rows().find(([key]) => key === "4")?.[1];
        expect(targetTop).toBe(230);
        expect(targetTop! - list.offset()).toBe(23);
    } finally {
        list.unmount();
    }
});

it("lets a drag take over from a silent Android initial-scroll retry", async () => {
    spyOn(platformScroll, "doScrollTo").mockImplementation(doNativeScrollTo);
    const list = await mountList("android", {
        drawDistance: 300,
        estimatedItemSize: 50,
        getFixedItemSize: undefined,
        initialScrollIndex: { index: 4, viewOffset: 13, viewPosition: 0.5 },
        showImmediately: false,
    });
    try {
        list.mount();
        list.layout(150);
        list.measureRows((key) => (key === "4" ? 90 : 50));
        for (let frame = 0; frame < 8 && list.scrollWrites.length < 2; frame++) list.tick();
        // The measured destination is 157px. Android nudges by 1px when the dispatch is silent.
        expect(list.scrollWrites).toEqual([157, 156]);
        expect(list.nativeContentStyle()?.opacity).toBe(0);

        list.emitScroll(156, "onScrollBeginDrag");
        list.emitScroll(425);
        list.tick();
        list.emitScroll(475, "onScrollEndDrag");
        for (let frame = 0; frame < 8; frame++) list.tick();

        expect(list.scrollWrites).toEqual([157, 156]);
        expect(list.nativeContentStyle()?.opacity).toBe(1);
        expect(list.state().scroll).toBe(475);
        expect(list.rows().filter(([, top]) => top! > 425 && top! < 625)).toEqual([
            ["8", 440],
            ["9", 490],
            ["10", 540],
            ["11", 590],
        ]);
    } finally {
        list.unmount();
    }
});

it("mounts an empty component, then allocates arriving data before Fabric layout", async () => {
    const list = await mountList("ios", { data: [], ListEmptyComponent: Empty });
    try {
        list.mount();
        expect(list.firstCommit()).toEqual([]);
        expect(JSON.stringify(list.tree())).toContain('"data-empty":true');
        expect(list.state().containerItemKeys.size).toBe(0);
        list.rerender({ data: ["50", "51", "52"] });
        expect(list.rows()).toEqual(positions(0, 2, 50));
        list.layout(150);
        expect(list.rows()).toEqual(positions(0, 2, 50));
    } finally {
        list.unmount();
    }
});

it("replaces provisional Fabric rows before layout without preserving a stale anchor", async () => {
    const list = await mountList("ios", { maintainVisibleContentPosition: true });
    try {
        list.mount();
        expect(list.firstCommit()).toEqual(positions(0, 3));
        list.rerender({ data: ["100", "101", "102"] });
        expect(list.rows()).toEqual(positions(0, 2, 100));
        list.layout(250);
        expect(list.rows()).toEqual(positions(0, 2, 100));
        expect(list.scrollWrites).toEqual([]);
    } finally {
        list.unmount();
    }
});

it("keeps legacy allocation unchanged with the opt-in", async () => {
    const list = await mountList("ios", {}, true);
    try {
        list.mount();
        expect(list.firstCommit()).toEqual(positions(0, 3));
        list.layout(150);
        expect(list.rows()).toEqual(positions(0, 3));
    } finally {
        list.unmount();
    }
});

it("shows the estimated short-list end padding and corrects it with real layout", async () => {
    const list = await mountList("ios", { alignItemsAtEnd: true, data: ["0", "1"] });
    try {
        list.mount();
        expect(list.firstCommit()).toEqual(positions(0, 1));
        expect(list.endPadding()).toBe(50);
        list.layout(100);
        expect(list.endPadding()).toBe(0);
        expect(list.rows()).toEqual(positions(0, 1));
        expect(list.scrollWrites).toEqual([]);
    } finally {
        list.unmount();
    }
});

it("mounts tail rows before Fabric layout and corrects the end target", async () => {
    const list = await mountList("ios", { initialScrollAtEnd: true });
    try {
        list.mount();
        expect(list.firstCommit()).toEqual(positions(27, 29));
        expect(list.offset()).toBe(1350);
        list.layout(250);
        for (let frame = 0; frame < 6; frame++) list.tick();
        expect(list.rows()).toEqual(positions(25, 29));
        expect(list.offset()).toBe(1250);
    } finally {
        list.unmount();
    }
});
