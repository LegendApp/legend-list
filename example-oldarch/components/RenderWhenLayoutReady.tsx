import { useEffect, useState } from "react";

export function RenderWhenLayoutReady({ children }: { children: React.ReactNode }) {
    const [ready, setReady] = useState(false);
    useEffect(() => {
        setTimeout(() => {
            setReady(true);
        }, 100);
    }, []);
    return ready ? children : null;
}
