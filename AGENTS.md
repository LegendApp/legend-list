# Repository Guidelines

## Plans
When I ask you to execute a plan file, after completing each step: check it off in the plan and immediately make a commit for that step. The first commit should add the plan, and each additional commit should check off one step.

## Project Structure & Module Organization
Legend List is a TypeScript React Native library. Core source lives in `src/`, split into feature folders such as `components` (public list primitives), `core` (scroll orchestration), `state` (shared contexts), and `utils`. Shared base types live in `types.base.ts`, with public entrypoint wrappers in `types.web.ts`, `types.react-native.ts`, and `types.root.ts`, while platform-specific integrations sit under `platform/` and `integrations/`. Unit and regression tests mirror this layout in `__tests__/`. `example/` contains the React Native showcase app, and `example-web/` houses the playground used in CI snapshots. Built artifacts land in `dist/` after a release, and should not be edited manually.

## Build, Test, and Development Commands
Install dependencies with `bun install`. Use `bun run build` to generate production bundles via `tsup` followed by post-build cleanups. Run `bun test` for the full suite, `bun test --watch` during local iteration, and `bun test --coverage` before publishing. `bun run lint` executes Biome checks across `src`, `__tests__`, and the example app. Type-level regressions are caught with `bun run tsc` (or `bun run tsc:go` when using ts-go-to-definition tooling).

## Coding Style & Naming Conventions
We rely on Biome for formatting; always run the lint script before pushing to ensure consistent 4-space indentation, trailing commas, and sorted imports. Components and classes use PascalCase, hooks use the `useFeature` camelCase pattern, and helper functions stay camelCase. Constants defined in `constants.ts` and similar modules use SCREAMING_SNAKE_CASE. Prefer explicit exports through barrel files (`src/index.ts`) to keep the public surface predictable.

## Lint / Formatting
- For any task that changes code, do not call the work done until formatting and lint autofix has been handled.
- Prefer writing changes in Biome-conforming style from the start, but still run `bun run lint:fix` before declaring completion when it is safe to do so.
- If repo-wide autofix would create unrelated churn in a dirty worktree, limit fixes to the touched files when possible; otherwise explicitly report that lint autofix was not run and why.
- If unused-import cleanup requires it, use `bun run lint:fix-unsafe` deliberately rather than leaving that cleanup for the user.

## Testing Guidelines
Unit tests live alongside features inside `__tests__` and should mirror file names from `src` with a `.test.tsx` suffix. Use React Native Testing Library and the helpers in `test-utils` for rendering scenarios; avoid snapshot churn by relying on semantic assertions. New behavior must include coverage and update related visualization artifacts via `bun run test:visualize` when debugging scroll offsets.

## Commit & Pull Request Guidelines
Follow Conventional Commits (`fix:`, `feat:`, `chore:`) as seen in recent history. Commit titles should be imperative, concrete, and descriptive enough to explain the changed behavior or artifact; avoid overly abstract titles even if they are short. Commit messages must use `type: subject` format with no scope parentheses; use `fix: handle null state`, not `fix(core): handle null state`. Do not add `Co-authored-by: Codex <noreply@openai.com>` to commits. Every PR should link to the relevant issue, describe the user-facing impact, and include reproduction steps or screenshots when UI is affected. Confirm `bun run lint`, `bun test`, and `bun run build` have passed before requesting review, and update the changelog with `bun run prep-changelog` when shipping user-visible changes.

## Task Completion Guidelines
- When asked to do multiple tasks in a plan file, when finished with each task:
    1. Mark the task complete in the plan file and save it
    2. Create a commit with a summarized description of the task, not including the [] prefix.
- When finished with the tasks and changes are committed to git, check the plan file again and if any new tasks have been added, continue doing those tasks.

## Communication Guidelines
- If the user asks any questions, do not make any changes, only answer the questions.
