# Pull request

## What changes?

<!-- One vertical capability per PR. Summarize the user-visible or structural effect. -->

## Checklist (CI runs the same gates)

- [ ] `npm run check:architecture`
- [ ] `npm run format:check`
- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run test:ci` (line coverage ≥ 80%)
- [ ] `npm run build` (bundle budgets)
- [ ] `npm run e2e` — when flows/UX changed
- [ ] `npm run audit:gate` — when dependencies changed

## Architecture impact?

<!-- New slice, boundary change, interceptor-order change, state strategy, new
     dependency? Link an ADR (docs/adr/) or say "none". -->

## Screenshots / recording

<!-- Required for UI changes. -->

## Notes for reviewers

<!-- Permissions added? i18n keys in all locales? Server-side enforcement reminder? -->
