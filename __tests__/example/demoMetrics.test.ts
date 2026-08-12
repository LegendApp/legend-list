import { createDemoMetricStore } from "../../example/lib/demoMetrics";

describe("demo metrics", () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it("batches metric updates without changing the published snapshot immediately", () => {
        const store = createDemoMetricStore([
            { id: "renders", initialValue: 0, label: "Row renders" },
            { id: "status", initialValue: "Idle", label: "Status" },
        ]);
        const listener = jest.fn();
        store.subscribe(listener);

        store.increment("renders");
        store.increment("renders");
        store.set("status", "Running");

        expect(store.getSnapshot()).toEqual([
            { id: "renders", label: "Row renders", value: 0 },
            { id: "status", label: "Status", value: "Idle" },
        ]);

        jest.runOnlyPendingTimers();

        expect(listener).toHaveBeenCalledTimes(1);
        expect(store.getSnapshot()).toEqual([
            { id: "renders", label: "Row renders", value: 2 },
            { id: "status", label: "Status", value: "Running" },
        ]);
        store.destroy();
    });

    it("resets values and publishes them immediately", () => {
        const store = createDemoMetricStore([
            { id: "renders", initialValue: 0, label: "Row renders" },
            { id: "mounted", initialValue: 0, label: "Mounted", resettable: false },
        ]);
        const listener = jest.fn();
        store.subscribe(listener);

        store.increment("renders", 4);
        store.increment("mounted", 3);
        jest.runOnlyPendingTimers();
        store.reset();

        expect(listener).toHaveBeenCalledTimes(2);
        expect(store.getSnapshot()[0]?.value).toBe(0);
        expect(store.getSnapshot()[1]?.value).toBe(3);
        store.destroy();
    });

    it("tracks live mounts exactly across reset and repeated cleanup", () => {
        const store = createDemoMetricStore([
            { id: "renders", initialValue: 0, label: "Row renders" },
            { id: "mounted", initialValue: 0, label: "Mounted" },
        ]);
        const unmountFirst = store.trackMount("mounted");
        const unmountSecond = store.trackMount("mounted");
        jest.runOnlyPendingTimers();

        store.reset();
        expect(store.getSnapshot()[1]?.value).toBe(2);

        unmountFirst();
        unmountFirst();
        jest.runOnlyPendingTimers();
        expect(store.getSnapshot()[1]?.value).toBe(1);

        unmountSecond();
        jest.runOnlyPendingTimers();
        expect(store.getSnapshot()[1]?.value).toBe(0);
        store.destroy();
    });

    it("atomically resets counters while reseeding current gauges", () => {
        const store = createDemoMetricStore([
            { id: "renders", initialValue: 0, label: "Row renders" },
            { id: "visible", initialValue: "—", label: "Visible" },
        ]);
        const listener = jest.fn();
        store.subscribe(listener);
        store.increment("renders", 5);
        store.set("visible", "4–10");
        jest.runOnlyPendingTimers();

        store.reset({ visible: "12–18" });

        expect(listener).toHaveBeenCalledTimes(2);
        expect(store.getSnapshot()).toEqual([
            { id: "renders", label: "Row renders", value: 0 },
            { id: "visible", label: "Visible", value: "12–18" },
        ]);
        store.destroy();
    });
});
