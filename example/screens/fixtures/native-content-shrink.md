# Native content shrink

Open `native-content-shrink` in the native fixture browser. The first row stays
mounted so its height can change from 400 to 100 while it is above the viewport.
End following is disabled to isolate content clamping and MVCP.

## Fabric commit regression

`Containers.native.test.tsx` mounts the real content container and Fabric
`PositionView`. It batches a 300px shrink above the last row:

| Publication | Content extent | Last row position |
| --- | ---: | ---: |
| Before the batch | 1000 | 900 |
| Before React commits, original code | 700 | 900 |
| Before React commits, fixed code | 1000 | 900 |
| After React commits | 700 | 600 |

The original code updates an Animated content extent immediately while Fabric row
positions wait for React. The regression asserts coherent geometry both before
and after the commit, vertically and horizontally. The fix uses the same React
subscription path for content extent as Fabric row positions. Old architecture
retains its Animated path, covered in a separate test process.

This test proves the mismatched publication order. It does not measure the duration
or visibility of a native frame.

## Independent React Native shrink/clamp reproduction

1. Select **Use raw RN** and leave **MVCP on**, with **Inset 0**.
2. Expand the first row if necessary, then press **End**.
3. Press **Shrink first row**, wait for scrolling to settle, then **Read geometry**.
4. Repeat with **MVCP off**.

On an iPhone 17 Pro simulator, iOS 26.5, React Native 0.81.5 with Fabric, tested
October 1, 2026, the raw `ScrollView` ends 300px above the bottom with MVCP on.
With MVCP off, both raw ScrollView and LegendList stay at the new bottom (remaining
distance approximately zero).
LegendList with MVCP on also ends 300px above the bottom, including with the
Fabric commit fix applied.

This distinguishes the React Native double clamp from the LegendList commit
ordering regression. The container fix does not fix this native MVCP bug. In RN's
`RCTScrollViewComponentView.mm`, resizing the scroll content can clamp its offset
before MVCP applies the full negative first-visible-row delta to that offset.
The plain ScrollView comparison is preserved for testing a native fix separately.
