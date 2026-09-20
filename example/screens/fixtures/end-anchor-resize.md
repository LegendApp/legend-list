# End anchor resize regression checks

Open **End Anchor Resize** (`/end-anchor-resize`) in the native fixture app on iOS or Android.
The React DOM counterpart is `/end-resize` in the web fixture catalog, or
`/end-resize.html` on the web fixture server for compositor-frame capture.

## Native checks

1. With long content and instant following, remount. The green footer should finish
   flush with the bottom, without overshooting and bouncing back.
2. Toggle the pinned bar repeatedly. The list should remain at the end after each
   layout settles. Native following is intentionally deferred, unlike web's
   before-paint resize correction.
3. Repeat with footer sizes 0, 16, and 80, including changing the footer while at end.
4. Select History, then toggle the bar. The reading position must not jump to end.
   Repeat by manually dragging away from the end.
5. Enable animated following. Select History, then End and toggle the bar while
   scrolling. There must be no competing instant correction or rebound.
6. Select Short content and repeat resizing and footer changes. Content should
   remain bottom-aligned without blank trailing space.
7. Select Center last with a large footer. Alignment must target the item rather
   than including the footer twice; the result may be clamped by the scroll range.

## Web checks

The standalone web fixture supports `?footer=0`, `?footer=16`, and `?footer=80`.
Toggle the pinned bar: the green end marker must remain at y=608 in every painted
frame. Select History and resize: the reading position must remain unchanged.
Select End: the scrollable end must be reached.

## Automated coverage and limits

`bun test __tests__/core/endAnchorResize.test.ts` runs the shared cases with web,
iOS, and Android platform branches. Web-only DOM/timing cases and native-only
deferred scheduling are explicitly scoped. These use mocked scrollers and RAF;
passing them does not substitute for running the native fixture on a simulator
or device, especially for native event ordering and animation.

## Verified 2026-09-19

- iPhone 17 Pro simulator, iOS 26.5, rebuilt development app using this repo's
  source through Metro: initial end placement, pinned-bar resize, footer changes
  (16/80/0), history preservation, short content, and animated return-to-end with
  resize were exercised. History offset stayed 340 while viewport grew 593 to
  649; the animated case settled at 2231 + 649 = 2880 (the content height).
- Returning to the initial settings matched the initial screenshot with 0%
  pixel mismatch outside the ignored status bar.
- `.argent/flows/end-anchor-ios-20260919.yaml` replayed successfully (23 action/check
  steps). Start from the fixture catalog with this repo's Metro on port 8081.
  It checks the interaction path, not numerical scroll geometry. One readiness
  step reported a small changing region; the fixture has no loading spinner.
- React DOM fixture: three compositor captures each with footer 0, 16, and 80
  kept the green marker at y=608 through resize. Repeated resize, history
  preservation, and returning to end passed for all three sizes, without page
  errors. This uses the temporary Humand diagnostic runner, not a new CI suite.
- Native transient frames were not captured like the browser compositor frames;
  native evidence above is interaction, settled geometry, and screenshot evidence.
