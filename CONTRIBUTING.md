# Contributing to Mimik

Thanks for your interest in contributing! Bug reports, feature requests, PRs, and translations are all welcome.

## Licensing

By submitting a pull request or any contribution to this repository, you agree that your contribution will be licensed under the [MIT License](./LICENSE).

You represent that you have the right to submit the contribution and that it does not infringe any third-party rights.

## Development Setup

### Prerequisites

- Node.js 22+
- [pnpm](https://pnpm.io) 10+
- Chrome or Firefox (for testing)

### Install

```bash
git clone https://github.com/westpoint-io/mimik.git
cd mimik
pnpm install
```

### Run in development

```bash
pnpm dev                   # Chrome (MV3) with HMR
pnpm dev:firefox           # Firefox (MV3) with HMR
```

WXT launches a fresh browser instance with the extension loaded.

### Build

```bash
pnpm build                 # Chrome → .output/chrome-mv3/
pnpm build:firefox         # Firefox → .output/firefox-mv3/
pnpm zip:all               # package both browsers
```

### Test

```bash
pnpm test                  # run all tests once
pnpm test:watch            # watch mode
pnpm test:cov              # coverage report
```

### Lint & format

```bash
pnpm lint                  # check
pnpm lint:fix              # auto-fix
pnpm format                # format only
```

### Code style

Biome handles formatting and linting. Run `pnpm lint:fix` and it sorts out indentation, quotes, semicolons and import order for you.

One rule Biome cannot check: do not write comments. Name things so the code explains itself. The exceptions are pragmas and directives the toolchain reads, such as `@ts-expect-error` or `biome-ignore`. When a piece of logic looks like it needs a comment to be understood, it usually wants a clearer name or a smaller function instead.

## Project Layout

```
src/
├── core/                    # Business logic (no UI dependencies)
│   ├── capture/             # Recording pipeline (events, AI, voice, DOM context)
│   ├── blur/                # Smart blur (regex presets, DOM scanner, panel)
│   ├── export/              # HTML, PDF, DOCX, Markdown, video, GIF generators
│   ├── transfer/            # .mimik bundles (export/import a guide between browsers)
│   ├── guideme/             # Guide replay (finder, overlay, session)
│   ├── screenshot/          # Rendering, annotations, geometry
│   └── guides/              # Data layer (types, Dexie DB, CRUD)
├── entrypoints/             # WXT extension entry points
│   ├── background/          # Service worker: state machine + message handlers
│   ├── content.ts           # Content script: event capture + capture session
│   ├── sidepanel/           # Side panel React mount
│   ├── fullview/            # Full-page dashboard mount
│   ├── onboarding/          # First-install wizard
│   └── options/             # Settings page mount
├── locales/                 # YAML translation files (en, de, es, fr, pt-BR, zh-CN)
├── lib/                     # Shared utilities (messaging, port, browser API)
├── stores/                  # Zustand state stores
└── ui/                      # React components
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Extension framework | [WXT](https://wxt.dev) (Manifest V3) |
| Language | TypeScript |
| UI | React 19 + Tailwind CSS v4 |
| Components | [shadcn/ui](https://ui.shadcn.com) |
| State (capture) | [XState](https://xstate.js.org) |
| State (UI) | [Zustand](https://zustand-demo.pmnd.rs) |
| Storage | [Dexie.js](https://dexie.org) (IndexedDB) |
| Messaging | [webext-core](https://webext-core.aklinker1.io) |
| Session recording | [rrweb](https://www.rrweb.io) |
| Export | [jsPDF](https://github.com/parallax/jsPDF), [docx](https://github.com/dolanmiu/docx), [mediabunny](https://github.com/Vanilagy/mediabunny), [gifenc](https://github.com/mattdesl/gifenc), [fflate](https://github.com/101arrowz/fflate) + HTML/Markdown |
| AI (optional) | [Vercel AI SDK](https://sdk.vercel.ai) (OpenAI, Anthropic) |
| i18n | [@wxt-dev/i18n](https://wxt.dev) + YAML locales |
| Testing | [Vitest](https://vitest.dev) + Testing Library |

## Pull Request Guidelines

1. Fork the repo and create a branch: `git checkout -b feat/your-feature`
2. Make your changes and add tests where applicable
3. Run the full check locally before pushing:
   ```bash
   pnpm lint && pnpm test && pnpm build && pnpm build:firefox
   ```
4. Use [Conventional Commits](https://www.conventionalcommits.org) for commit messages:
   - `feat:` new feature
   - `fix:` bug fix
   - `docs:` documentation
   - `test:` tests only
   - `chore:` tooling/deps
5. Open a PR with a clear description of what and why

CI (`pr-test.yml`) will run lint, tests, and both browser builds on every PR.

## Using AI Tools

AI-assisted contributions are welcome here.

Tick the disclosure box in the pull request template and name the tools you used. Saying so costs you nothing. Passing off output you have not read is what gets a PR closed.

You are responsible for every line you submit. If a reviewer asks why something is there, "the model wrote it" is not an answer. Be ready to debug it without going back to the tool.

Write the pull request description yourself. Generated summaries run long and restate the diff, which reviewers can already read. Two sentences on what changed and why beats ten paragraphs. Same for issue reports and review comments.

Reproduce a bug before you file it. Issues written by pointing a tool at the codebase, with no real reproduction, get closed unread.

Leave `good first issue` alone. Those exist for people learning the codebase by hand.

Do not run automated AI reviews on pull requests in this repo. Your own fork is fine.

Repeat submissions of unread AI output will get you blocked.

## Adding a Translation

To add a new language:

1. Create `src/locales/{lang-code}.yml` (e.g., `src/locales/de.yml`)
2. Copy the structure from `src/locales/en.yml`
3. Translate all values, keeping the keys identical
4. Keep substitution placeholders (`$1`, `$2`) in the same positions
5. Build and test: `pnpm build:firefox` (WXT generates types for new locale keys automatically)

## Reporting Bugs

Open an issue with:

- What you expected to happen
- What actually happened
- Steps to reproduce
- Browser + version (Chrome / Firefox)
- Screenshots if relevant
- Any errors from the extension console (`chrome://extensions` → Mimik → "service worker" → Console, or Firefox `about:debugging` → Inspect)
