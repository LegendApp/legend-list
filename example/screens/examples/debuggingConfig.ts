export type DebuggingDemoId = "images" | "render-window" | "row-cost";

export const DEBUGGING_ROUTE_SLUG = "debugging";

export const DEBUGGING_DEMOS: Array<{
    description: string;
    id: DebuggingDemoId;
    label: string;
    title: string;
}> = [
    {
        description: "Profile how expensive row components amplify every mount and update.",
        id: "row-cost",
        label: "Row cost",
        title: "Slow Rows",
    },
    {
        description: "Inspect visible, buffered, and mounted rows while changing drawDistance.",
        id: "render-window",
        label: "Window",
        title: "Render Window",
    },
    {
        description: "Compare reserved image geometry with sizes that arrive only after loading.",
        id: "images",
        label: "Images",
        title: "Delayed Image Sizes",
    },
];

export function buildDebuggingHref(demoId: DebuggingDemoId) {
    return `/${DEBUGGING_ROUTE_SLUG}?demo=${demoId}`;
}

export const DEBUGGING_HOME_ENTRIES = DEBUGGING_DEMOS.map((demo) => ({
    description: demo.description,
    href: buildDebuggingHref(demo.id),
    id: `debugging-${demo.id}`,
    title: demo.title,
}));

function getSingleSearchParam(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] : value;
}

export function getDebuggingDemo(value: string | string[] | undefined) {
    const demoId = getSingleSearchParam(value);
    return DEBUGGING_DEMOS.find((demo) => demo.id === demoId) ?? DEBUGGING_DEMOS[0];
}
