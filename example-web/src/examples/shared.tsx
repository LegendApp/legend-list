import type React from "react";

import type { ChatAttachment } from "@examples/chat";

export function Shell({
    title,
    children,
    windowScroll,
}: {
    title: string;
    children: React.ReactNode;
    windowScroll?: boolean;
}) {
    return (
        <div className={windowScroll ? "flex min-w-0 flex-col gap-4" : "flex min-h-0 min-w-0 flex-1 flex-col gap-4"}>
            <h1 className="m-0 text-[34px]">{title}</h1>
            <div className={windowScroll ? "" : "flex min-h-0 min-w-0 flex-1"}>{children}</div>
        </div>
    );
}

export const CARD_CLASS = "mb-3 rounded-[18px] border border-slate-200 p-4";

export function cardStyle(color = "#fff"): React.CSSProperties {
    return { background: color };
}

export function buttonStyle(active = false) {
    return [
        "cursor-pointer rounded-full border border-gray-300 px-[14px] py-[10px] font-bold",
        active ? "bg-gray-900 text-white" : "bg-white text-gray-900",
    ].join(" ");
}

export const listViewportStyle: React.CSSProperties = {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
};

export function ChatAttachmentCard({ attachment }: { attachment: ChatAttachment }) {
    return (
        <div
            className="mb-[10px] flex w-[220px] flex-col items-start justify-end overflow-hidden rounded-2xl p-3 text-white"
            style={{
                background: attachment.accent,
                height: attachment.height,
            }}
        >
            <div className="text-xs font-extrabold uppercase tracking-[0.5px] opacity-[0.88]">{attachment.label}</div>
            <div className="mt-1.5 text-[20px] font-extrabold">{attachment.subtitle}</div>
        </div>
    );
}
