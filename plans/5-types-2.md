## Plan

Eliminate all `react-native` imports from the `@legendapp/list/web` import tree (including generated `.d.ts`), and add a guardrail that fails if `dist/web.d.ts` ever references `react-native`.

## Goals

- `@legendapp/list/web` has no `react-native` imports in its runtime or type dependency tree.
- `dist/web.d.ts` contains no `react-native` references after build.
- React Native entrypoints retain strong RN typings.
- Core implementation remains shared where possible; RN-specific types stay isolated to `.native.*` files.

## Guardrails

- Add a build-time check that fails if `dist/web.d.ts` contains the string `react-native`.
- Optionally expose a script (e.g. `bun run check:web-dts`) and/or wire it into CI/build.

## Implementation Outline

- Add `src/platform/scrollview-types.ts` (RN-free base types used internally only; not part of public API).
- Update shared components to import from `@/platform/scrollview-types` instead of `react-native` so the web `.d.ts` stays RN-free.
- Prefer `@/types.base` in shared/non-native files so internal typing uses base types (no platform split).
- Ensure `src/web.ts` and `src/types.web.ts` only export web-safe types and do not re-export anything that depends on RN.
- Validate that `tsup` output for `web.d.ts` is free of `react-native` references.

## Tests

- Add a simple post-build check: `grep -q "react-native" dist/web.d.ts` should fail the build.
- Run `bun run build` and `bun run tsc` once after refactor to confirm typings.

## Steps

- [x] Add `src/platform/scrollview-types.ts` and update shared components to import base types from the shim.
- [ ] Replace remaining `@/types` imports in shared/non-native code with `@/types.base` and verify `web.d.ts` is RN-free.
- [ ] Add the `dist/web.d.ts` guardrail script and document/run it.
