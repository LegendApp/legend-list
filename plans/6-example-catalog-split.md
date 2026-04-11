## Plan

Split `example` and `example-web` into two script-selected modes:

- `examples`: the default, curated user-facing catalog
- `fixtures`: the internal validation/debug catalog

Both apps should expose the same 12 curated example slugs and preserve current fixture routes as much as possible.

## Mode Contract

- `examples` is the default mode in both apps.
- Native scripts use plain defaults for `examples`: `start`, `ios`, `android`.
- Native fixture scripts are explicit: `start:fixtures`, `ios:fixtures`, `android:fixtures`.
- Web scripts use plain defaults for `examples`: `dev` and `build`.
- Web fixture scripts are explicit: `dev:fixtures` and `build:fixtures`.
- Mode is selected by environment variable/package script, not by URL path segments.
- Do not add in-app links between `examples` and `fixtures`; each mode is self-contained.

## Catalog Structure

- Share only plain TypeScript demo data/models/helpers between native and web.
- Keep UI/rendering code platform-specific.
- Do not import `example/` files into `example-web/`; any shared logic must live in a neutral shared location.
- Preserve current fixture slugs where possible for compatibility.
- Do not preserve old example slugs as aliases once curated `examples` are introduced.
- Use a shared controlled tag vocabulary across both apps.
- Order catalogs manually, not alphabetically.

## Examples Catalog

Curated `examples` should feel like believable product surfaces, not prop labs.

- Use product-style naming and reskinned data, not just renamed current demos.
- Use deterministic seeded data with light local simulation where appropriate.
- Keep controls minimal and purposeful.
- Keep individual example screens product-first without visible teaching copy.
- On catalog cards, show titles plus compact feature tags.

Use the same four groups across both apps:

- `Messaging`
- `Directory`
- `Commerce`
- `Media`

Native `examples` shell:

- grouped catalog home
- simple stack flow into each example

Web `examples` shell:

- root page is a grouped card-grid catalog
- example detail pages keep a sidebar-style shell

## Fixtures Catalog

Move all current screens into `fixtures` before building the polished `examples` catalog.

- Keep fixtures grouped by debug behavior area.
- Show fixture titles plus compact debug tags.
- Keep comparison/benchmark demos in `fixtures` only.
- No special carveouts beyond preserving current fixture slugs where possible.

## Shared Curated Example Set

Both apps should expose these 12 slugs with the same core behaviors:

1. `chat`
2. `ai-chat`
3. `directory`
4. `sectioned-directory`
5. `product-shelf`
6. `cards-feed`
7. `media-rails`
8. `video-feed`
9. `notifications-inbox`
10. `activity-history`
11. `gallery-grid`
12. `infinite-calendar`

Adaptation sources:

- `chat`: current `chat-example`
- `ai-chat`: current `ai-chat`
- `directory`: current `countries`
- `sectioned-directory`: current `countries-with-headers-sticky`
- `product-shelf`: current `product-shelf`
- `cards-feed`: current card/feed item UI
- `media-rails`: current `Movies`
- `video-feed`: current `video-feed`
- `notifications-inbox`: current `add-to-end`
- `activity-history`: current `bidirectional-infinite-list`
- `gallery-grid`: current `columns`
- `infinite-calendar`: new build

`infinite-calendar` requirements:

- one route
- in-screen toggle between vertical continuous scroll and horizontal month paging
- preserve current temporal position when toggling

## Rollout Order

1. Add mode plumbing and default/fixture scripts for both apps.
2. Extract neutral shared demo data/helpers into a non-platform folder.
3. Move all current screens into `fixtures` catalogs without changing behavior.
4. Build native `examples` catalog shell and route registry.
5. Build web `examples` catalog home + detail shell and route registry.
6. Adapt current screens into the curated example set.
7. Build the fresh `infinite-calendar` example in both apps.
8. Validate route parity, script behavior, and mode isolation in both apps.

## Validation

- `examples` must be the default mode in both apps.
- `fixtures` must remain reachable through explicit scripts.
- Both apps must expose the same 12 example slugs.
- Current fixture routes should remain reachable with preserved names where possible.
- `example-web` must not import from `example/`.

## Steps

- [x] Add script-selected mode plumbing for `example` and `example-web`, with `examples` as default and explicit `fixtures` scripts.
- [x] Extract neutral shared demo data/models/helpers into a non-platform shared location safe for both apps.
- [ ] Move all current native and web demo routes into grouped `fixtures` catalogs while preserving existing fixture slugs where possible.
- [ ] Build the native `examples` grouped catalog home and route the 12 curated example slugs through a simple stack flow.
- [ ] Build the web `examples` grouped card-grid home, then route example detail pages through a sidebar-style shell.
- [ ] Adapt existing screens into the curated `chat`, `ai-chat`, `directory`, `sectioned-directory`, `product-shelf`, `cards-feed`, `media-rails`, `video-feed`, `notifications-inbox`, `activity-history`, and `gallery-grid` examples.
- [ ] Build the new `infinite-calendar` example in both apps with a vertical/horizontal toggle that preserves temporal position.
- [ ] Validate script behavior, route parity, fixture preservation, and web/native isolation.
