import { expect, it } from "bun:test";
import "../setup";

import { Empty, mountList, positions } from "./LegendList.showImmediately.cases";

it.each([75, 150, 275])(
    "corrects the first web commit's %d estimate through ResizeObserver",
    async (estimatedHeight) => {
        const list = await mountList("web", { estimatedListSize: { height: estimatedHeight, width: 250 } });
        try {
            list.mount();
            expect(list.firstCommit()).toEqual(positions(0, Math.floor(estimatedHeight / 50)));
            expect(list.state().lastLayout).toBeUndefined();
            expect(list.tree()).toMatchObject({ props: { style: { opacity: 1 } }, type: "div" });
            list.layout(150);
            expect(list.renderedRange()).toEqual([0, 3]);
            expect(list.rows()).toEqual(positions(0, Math.max(3, Math.floor(estimatedHeight / 50))));
            expect(list.scrollWrites).toEqual([]);
        } finally {
            list.unmount();
        }
    },
);

it.each([undefined, false])(
    "waits for web layout with fixed sizes when showImmediately is %s",
    async (showImmediately) => {
        const list = await mountList("web", { showImmediately });
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

it("uses the window width for the first horizontal web commit", async () => {
    const previousWidth = window.innerWidth;
    window.innerWidth = 175;
    const list = await mountList("web", { estimatedListSize: undefined, horizontal: true });
    try {
        list.mount();
        expect(list.firstCommit()).toEqual(positions(0, 3));
        list.layout(250);
        expect(list.rows()).toEqual(positions(0, 5));
    } finally {
        list.unmount();
        window.innerWidth = previousWidth;
    }
});

it("mounts web rows around the initial index before layout and settles at the index", async () => {
    const list = await mountList("web", { initialScrollIndex: 10 });
    try {
        list.mount();
        expect(list.firstCommit()).toEqual(positions(10, 13));
        for (let frame = 0; frame < 10; frame++) list.tick();
        expect(list.scrollWrites).toEqual([]);
        list.layout(150);
        for (let frame = 0; frame < 4; frame++) list.tick();
        expect(list.rows()).toEqual(positions(10, 13));
        expect(list.offset()).toBe(500);
    } finally {
        list.unmount();
    }
});

it("populates an empty web list before measurement", async () => {
    const list = await mountList("web", { data: [], ListEmptyComponent: Empty });
    try {
        list.mount();
        expect(list.firstCommit()).toEqual([]);
        expect(JSON.stringify(list.tree())).toContain('"data-empty":true');
        list.rerender({ data: ["50", "51", "52"] });
        expect(list.rows()).toEqual(positions(0, 2, 50));
        list.layout(150);
        expect(list.rows()).toEqual(positions(0, 2, 50));
    } finally {
        list.unmount();
    }
});

it("keeps readiness callbacks tied to real layout", async () => {
    const events: string[] = [];
    const list = await mountList("web", {
        onFirstVisibleItemChanged: () => void events.push("visible"),
        onLoad: () => void events.push("load"),
        onReady: () => void events.push("ready"),
    });
    try {
        list.mount();
        expect(list.firstCommit()).toEqual(positions(0, 3));
        expect(events).toEqual([]);
        list.layout(150);
        expect(events.slice().sort()).toEqual(["load", "ready", "visible"]);
    } finally {
        list.unmount();
    }
});
