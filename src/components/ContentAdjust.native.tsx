// biome-ignore lint/style/useImportType: Leaving this out makes it crash in some environments
import * as React from "react";

export function ContentAdjust({
    children,
    horizontal: _horizontal,
}: {
    children: React.ReactNode;
    horizontal: boolean;
}) {
    return children;
}
