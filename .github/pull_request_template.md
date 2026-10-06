> **AI model(s) used (required):** <!-- Name every model you used, or write "None". You are responsible for every line either way. -->

## Type of change

<!-- Tick one. -->

- [ ] ✨ New feature (feat)
- [ ] 🐛 Bug fix (fix)
- [ ] ♻️ Refactor (refactor)
- [ ] ⚡ Performance (perf)
- [ ] 🌐 Translation or locale (i18n)
- [ ] 📝 Documentation (docs)
- [ ] ✅ Tests only (test)
- [ ] 🔧 Tooling or dependencies (chore)

## Description

<!-- Two sentences: what changed and why. Write it yourself. Don't paste a
     generated summary of the diff, we can read the diff. -->

## Related issue

Closes #

## Both apps

<!-- Mimik is one codebase with two apps: the browser extension and the desktop app. -->

- [ ] This change applies to: extension / desktop / both <!-- delete the ones that don't apply -->
- [ ] If it applies to both, it lives in `packages/core` or `packages/ui`, or the other app got the same change
- [ ] Anything that names a shared concept uses the name the other app already uses

## How this was tested

- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm build:firefox` passes locally
- [ ] For desktop changes: `pnpm --filter @mimik/desktop check:pipeline` and `check:overlay` pass <!-- CI does not run on fork PRs until a maintainer approves it. -->
- [ ] Tested by hand in the browser, and in the desktop app if it changed
- [ ] Tests added or updated

## Screenshots

<!-- Required for any UI change. Mimik is a visual tool and a green test run
     does not show whether a guide still looks right. -->

## Checklist

- [ ] I can explain and debug every line, without going back to an AI tool
- [ ] Commits follow [Conventional Commits](https://www.conventionalcommits.org)
- [ ] Existing behaviour still works
