# Keyboard viewability regression

Open **Keyboard Viewability** (`keyboard-viewability`) on native.

1. Open the keyboard, press **Move to 600**, then **Read** after it settles.
2. Inspect which numbered rows remain visible above the floating input.
3. Close the keyboard, press **Move to 600**, then **Read** again.

Verified October 2, 2026 on iPhone 17 Pro / iOS 26.5 / RN 0.81.5 Fabric:

| Settled geometry | Original reported rows | Fixed reported rows |
| --- | --- | --- |
| Offset 600, native viewport 580.3, keyboard 335, 100px rows | 6–11 | 6–7 |
| Same offset and viewport, keyboard closed | 6–11 | 6–11 |

Row 8 has less than 50px unobscured, so the configured 50% item threshold excludes
it. Rows 9–11 are behind the keyboard. The native list's layout height remains
580.3: keyboard occlusion is separate from layout size.

The integration now reports actual keyboard movement and composer padding as a
viewability inset through an internal ref bridge. Reserved blank space and ordinary
content insets remain scroll-range geometry, not automatically occlusion. Updating
this inset refreshes viewability without issuing a scroll command. A fully covered
viewport reports no viewable items and finite coverage amounts.

`keyboard.viewability.cases.tsx` mounts the real integration and LegendList with a
controlled native scroll surface and keyboard/Reanimated events. It checks both
platform branches, dismissal, interactive movement with an unchanged large range
inset, keyboard offsets, and composer resizing without a scroll event. Core tests
also preserve item-percentage versus viewport-coverage semantics for tall rows.
The Android cases are automated; Android native motion was not exercised.
