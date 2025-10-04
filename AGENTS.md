# Repository Guidelines

## Project Structure & Module Organization
Legend List is a TypeScript React Native library. Core source lives in `src/`, split into feature folders such as `components` (public list primitives), `core` (scroll orchestration), `state` (shared contexts), and `utils`. Shared types are in `types.ts`, while platform-specific integrations sit under `platform/` and `integrations/`. Unit and regression tests mirror this layout in `__tests__/`. `example/` contains the React Native showcase app, and `example-web/` houses the playground used in CI snapshots. Built artifacts land in `dist/` after a release, and should not be edited manually.

## Build, Test, and Development Commands
Install dependencies with `bun install`. Use `bun run build` to generate production bundles via `tsup` followed by post-build cleanups. Run `bun test` for the full suite, `bun test --watch` during local iteration, and `bun test --coverage` before publishing. `bun run lint` executes Biome checks across `src`, `__tests__`, and the example app. Type-level regressions are caught with `bun run tsc` (or `bun run tsc:go` when using ts-go-to-definition tooling).

## Coding Style & Naming Conventions
We rely on Biome for formatting; always run the lint script before pushing to ensure consistent 4-space indentation, trailing commas, and sorted imports. Components and classes use PascalCase, hooks use the `useFeature` camelCase pattern, and helper functions stay camelCase. Constants defined in `constants.ts` and similar modules use SCREAMING_SNAKE_CASE. Prefer explicit exports through barrel files (`src/index.ts`) to keep the public surface predictable.

## Testing Guidelines
Unit tests live alongside features inside `__tests__` and should mirror file names from `src` with a `.test.tsx` suffix. Use React Native Testing Library and the helpers in `test-utils` for rendering scenarios; avoid snapshot churn by relying on semantic assertions. New behavior must include coverage and update related visualization artifacts via `bun run test:visualize` when debugging scroll offsets.

## Commit & Pull Request Guidelines
Follow Conventional Commits (`fix:`, `feat:`, `chore:`) as seen in recent history; scope optional but recommended. Every PR should link to the relevant issue, describe the user-facing impact, and include reproduction steps or screenshots when UI is affected. Confirm `bun run lint`, `bun test`, and `bun run build` have passed before requesting review, and update the changelog with `bun run prep-changelog` when shipping user-visible changes.
