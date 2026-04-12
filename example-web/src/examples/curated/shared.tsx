import type React from "react";

import type { ChatAttachment } from "@examples/chat";

export function Shell({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div style={{ display: "flex", flex: 1, flexDirection: "column", gap: 16, minHeight: 0, minWidth: 0 }}>
            <h1 style={{ fontSize: 34, margin: 0 }}>{title}</h1>
            <div style={{ display: "flex", flex: 1, minHeight: 0, minWidth: 0 }}>{children}</div>
        </div>
    );
}

export function cardStyle(color = "#fff"): React.CSSProperties {
    return {
        background: color,
        border: "1px solid #e5e7eb",
        borderRadius: 18,
        marginBottom: 12,
        padding: 16,
    };
}

export function buttonStyle(active = false): React.CSSProperties {
    return {
        background: active ? "#111827" : "#fff",
        border: "1px solid #d1d5db",
        borderRadius: 999,
        color: active ? "#fff" : "#111827",
        cursor: "pointer",
        fontWeight: 700,
        padding: "10px 14px",
    };
}

export const listViewportStyle: React.CSSProperties = {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
};

export function ChatAttachmentCard({ attachment }: { attachment: ChatAttachment }) {
    return (
        <div
            style={{
                alignItems: "flex-start",
                background: attachment.accent,
                borderRadius: 16,
                color: "#fff",
                display: "flex",
                flexDirection: "column",
                height: attachment.height,
                justifyContent: "flex-end",
                marginBottom: 10,
                overflow: "hidden",
                padding: 12,
                width: 220,
            }}
        >
            <div
                style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.5, opacity: 0.88, textTransform: "uppercase" }}
            >
                {attachment.label}
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, marginTop: 6 }}>{attachment.subtitle}</div>
        </div>
    );
}
