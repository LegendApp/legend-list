import { expect, it } from "bun:test";
import "../setup";

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
