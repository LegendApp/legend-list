---
id: issue-508-programmatic-scroll-unmount-cleanup
source_type: github_issue
source: gh
repo: LegendApp/legend-list
issue_number: 508
issue_url: https://github.com/LegendApp/legend-list/issues/508
issue_title: "[v3] Programmatic-scroll fallback timer survives LegendList unmount"
triage_status: done
issue_type: bug
area: core
severity: high
urgency: low
effort: m
confidence: high
repro_quality: strong
priority_score: 20
priority_reason: The local implementation now cancels all imperative-scroll completion work and settles pending promises on unmount; review, release, and reporter verification remain.
next_action: done
approval: approved
implementation_status: completed
base_ref: main@26822d6b
agent_doc_version: 1
updated_at: "2026-08-08"
---

# Merge Review

**Verdict: Ready to merge.** The fix owns the complete imperative-scroll lifecycle, has focused coverage for every cancellation phase, and adds no meaningful common-path cost.

Issue: [#508](https://github.com/LegendApp/legend-list/issues/508)
Base: `main@26822d6b`

## Problem

Unmounting during a programmatic scroll could leave native completion timers or frames alive. Canceling only those handles was insufficient because web completion listeners, readiness polling, and the public scroll promise could also remain active.

Required behavior:

- No list-owned completion callback may act after unmount.
- A canceled public scroll promise resolves exactly once, matching request supersession.
- Teardown must not run the layout recalculation used by normal scroll completion.
- Handle `0` is a valid timeout or animation-frame identifier and must be canceled.

## Solution

- `ScheduledWork` owns native completion frames, fallback timeouts, readiness polling, and the current web completion disposer under explicit keys.
- Canceled or replaced registry callbacks verify that they still own their key before running, so even late queued work cannot act on an unmounted list or a newer scroll.
- `settlePendingImperativeScroll` is the single promise-settlement policy used by both supersession and teardown.
- `cancelImperativeScroll` clears the active target and resolves its promise without calling `finishScrollTo`.
- `LegendList` calls that shared teardown path and disposes the remaining registry work on unmount.

The web scroll listeners and their idle/max timers are one completion session, so the registry tracks one cleanup for the group rather than exposing several independent state fields.

## Why It Is Correct

| Invariant | Coverage |
|---|---|
| Zero-valued and repeated native completion frames are canceled | `checkFinishedScroll.test.ts`, `scrollTo.test.ts` |
| Old web targets cannot finish a newer scroll | `doScrollTo.web.test.ts` |
| Web delayed timers and animated listeners are removed | `doScrollTo.web.test.ts` |
| A late readiness callback cannot start after cancellation | `createImperativeHandle.test.ts` |
| `scrollToOffset`, readiness-gated `scrollToIndex`, and deferred `scrollToEnd` settle exactly once | `createImperativeHandle.test.ts` |
| Mounted-list teardown clears completion work and target state | `LegendList.props.test.tsx` |

## Validation

- Focused lifecycle suite: 111 tests passed.
- Full suite: 1,547 tests passed across 112 files.
- `bun run tsc:src`, `bun run lint:fix`, `bun run lint`, `bun run build`, and `git diff --check` passed.

Not performed: the reporter's exact React Native application was not run on a device during teardown. The ownership tests cover the race directly, so this is release-verification risk rather than a merge blocker.

PR #509 overlaps the native portion of this implementation and should not be merged independently.

## Release Follow-up

> [!IMPORTANT]
> Not released yet. This reply assumes the fix will ship in `v3.3.4`; verify the published version before posting.

Thanks for the clear report and reproduction! This is fixed in `v3.3.4`. Programmatic scroll work is now cleaned up when a list unmounts. Please update and let us know if you still see any timers survive teardown.
