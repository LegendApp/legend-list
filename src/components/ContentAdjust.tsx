import type * as React from "react";

export function ContentAdjust({
    children,
    horizontal: _horizontal,
}: {
    children: React.ReactNode;
    horizontal: boolean;
}) {
    return <>{children}</>;
}
