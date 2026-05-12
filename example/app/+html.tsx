// Learn more https://docs.expo.dev/router/reference/static-rendering/#root-html

import { ScrollViewStyleReset } from "expo-router/html";

// This file is web-only and used to configure the root HTML for every
// web page during static rendering.
// The contents of this function only run in Node.js environments and
// do not have access to the DOM or browser APIs.
export default function Root({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <head>
                <meta charSet="utf-8" />
                <meta content="IE=edge" httpEquiv="X-UA-Compatible" />
                <meta content="width=device-width, initial-scale=1, shrink-to-fit=no" name="viewport" />

                {/*
                  Disable body scrolling on web. This makes ScrollView components work closer to how they do on native.
                  However, body scrolling is often nice to have for mobile web. If you want to enable it, remove this line.
                */}
                <ScrollViewStyleReset />
            </head>
            <body>{children}</body>
        </html>
    );
}
