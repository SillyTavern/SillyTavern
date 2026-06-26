# SillyTavern

LLM Frontend for Power Users

## Hosted AI Tavern MVP

This branch adds a hosted AI tavern marketplace and wallet MVP on top of SillyTavern. It is aimed at a web/PWA-first product where users can open the app, browse or upload content, buy or claim assets with coins, and install assets into their private SillyTavern data space without deploying their own server.

### Marketplace And Wallet

- Built-in `marketplace-wallet` extension in the Extensions panel.
- Wallet balances split into `bonus`, `paid`, and `earnings` buckets.
- Immutable wallet ledger for grants, purchases, debits, and creator earnings.
- Recent wallet activity in the wallet panel, including grants, purchases, debits, and creator earnings.
- Marketplace assets for character cards and world books.
- Asset details popup with tags, language, content rating, stable listed/delisted lifecycle dates, entitlement source/date, purchase reference, and payload visibility; visible type, price, access, language/rating search, sort, and clear-filter controls for marketplace browsing.
- Creator upload flow for draft assets, tags, JSON payload validation, file/pasted JSON type auto-detect, and submit-for-review.
- Creator revision flow for draft or rejected assets before resubmission.
- Creator Center summary for owned assets, draft/submitted/listed/rejected status counts, audit dates, rejection reasons, claims, paid sales, installs, earned coins, and earnings balance.
- My Library view for claimed or purchased assets with entitlement dates, recent install summaries, details, and reinstall actions.
- Installable PWA shell for mobile browsers using the existing web app and static shell cache.
- Admin review queue with creator, price, tag, summary, inspect/approve/reject actions.
- Admin delist action to remove listed assets from public purchase while preserving existing entitlements.
- User report action with reason/details body and admin report queue with reported dates and resolve workflow for marketplace moderation.
- Admin coin grants for `bonus`, `paid`, and `earnings`.
- Free and fixed-price purchase flow with `bonus -> paid` spending order.
- Fixed-price cards show the missing bonus/paid coin amount when the buyer cannot afford them.
- Install flow copies approved/purchased assets into the user's private data directory.

### Run Locally

Requirements:

- Node.js 20 or newer.
- npm.

Install dependencies:

```bash
npm install
npm --prefix tests install
```

Optional demo content:

```bash
npm run marketplace:seed:demo -- --dataRoot ./data
```

Start the app:

```bash
npm start
```

Open `http://127.0.0.1:8000` and use the Extensions panel to find `Marketplace & Wallet`. Users can view recent wallet ledger activity from the wallet panel.
The demo seed command writes two listed assets into the explicit data root: a free character card and a fixed-price world book. Run it against the same data root your local config uses.

The local MVP APIs live under `/api/market` and `/api/wallet`. Creator Center uses `GET /api/market/creator/summary`; full wallet balances and ledger history remain available through `/api/wallet` and `/api/wallet/ledger`. Hosted probes can use `GET /api/health` without a logged-in session.

On mobile, open the same URL in a browser and use the browser's Add to Home Screen / Install action. The PWA service worker caches only the static shell and never caches `/api/*` wallet, market, or chat requests.

### Useful Scripts

```bash
# Start the app
npm start

# Start with CSRF disabled for local API smoke testing
npm run start:no-csrf

# Seed demo marketplace assets into an explicit data root
npm run marketplace:seed:demo -- --dataRoot ./data

# Export a redacted market/wallet snapshot outside the data root
npm run marketplace:export:snapshot -- --dataRoot ./data --out ./marketplace-snapshot.json

# Export the current marketplace/wallet/health API reference
npm run marketplace:export:api -- --out ./marketplace-api-reference.md

# Run marketplace/wallet/PWA/health syntax and contract tests
npm run test:marketplace

# Run the slow pre-release marketplace loop: contract tests, runtime smoke, browser E2E
PLAYWRIGHT_BROWSER_CHANNEL=chrome npm run test:marketplace:all

# Run only the marketplace/wallet/PWA/health syntax gate
npm run test:marketplace:syntax

# Start a temporary server and smoke-test health/PWA public endpoints
npm run test:marketplace:smoke

# Run only the mobile/PWA shell contract test
npm run test:pwa

# Run only the browser-level mobile/PWA service worker E2E
# Uses a temporary local server and one Playwright worker for service worker isolation.
PLAYWRIGHT_BROWSER_CHANNEL=chrome npm run test:pwa:e2e

# Run marketplace/wallet browser E2E tests
# Requires Playwright browsers:
#   tests/node_modules/.bin/playwright install --no-shell chromium
# Or use an installed Chrome browser:
#   PLAYWRIGHT_BROWSER_CHANNEL=chrome npm run test:marketplace:e2e:server
# Starts a temporary local server automatically:
npm run test:marketplace:e2e:server

# Or run against an already-started local app server:
# Requires a local app server in another terminal:
#   npm run start:no-csrf
npm run test:marketplace:e2e

# Run the existing test package suites
npm --prefix tests run test:unit
npm --prefix tests run test:e2e
```

Validation matrix:

| Command | Coverage |
|---------|----------|
| `npm run test:marketplace:syntax` | Fast JS syntax gate for marketplace/wallet endpoints, PWA files, scripts, and targeted tests. |
| `npm run test:marketplace` | Syntax gate plus marketplace, wallet, PWA, health, seed, snapshot export, API reference export, filter, upload tags, and UI contract tests. |
| `npm run test:marketplace:smoke` | Temporary local server smoke covering health, PWA shell, wallet, market assets, creator upload/submit/approve, Creator Center stats, report create/queue/resolve, free and fixed-price claim/install, buyer debit, creator earning, Library, and file write. |
| `npm run test:pwa:e2e` | Temporary local server plus Playwright service worker E2E for shell cache registration and `/api/*` cache exclusion; use `PLAYWRIGHT_BROWSER_CHANNEL=chrome` to run with installed Chrome. |
| `npm run test:marketplace:e2e:server` | Temporary local server plus Playwright marketplace browser E2E for PWA service worker, admin, report submit/resolve, asset details metadata, creator upload tags/type auto-detect/submit, empty-filter reset, unaffordable fixed-price cards, rejected asset revise/resubmit, free and fixed-price buy/install, wallet activity, Library dates/install summaries/details/reinstall, and mobile layout; use `PLAYWRIGHT_BROWSER_CHANNEL=chrome` to run with installed Chrome. |
| `npm run test:marketplace:all` | Slow pre-release loop that runs `test:marketplace`, `test:marketplace:smoke`, and `test:marketplace:e2e:server` in sequence. |

### Development Notes

- The MVP still uses JSON/node-persist storage and is intended for local validation, not production SaaS scale.
- `npm run marketplace:export:snapshot` creates a redacted read-only market/wallet snapshot with asset lifecycle timestamps for backup checks and migration rehearsals; output files must be outside the data root.
- `npm run marketplace:export:api` generates a Markdown reference from the current market, wallet, and public health routes, including key permission/privacy notes, with tests locking the full MVP route set; pass `--out` to write it to a file.
- Paid purchase responses return the entitlement, ownership status, purchase id, and buyer balance only; creator balances and full ledger entries remain behind wallet/creator APIs.
- Production deployment should migrate market assets, entitlements, installs, wallet accounts, and wallet ledger entries to a transactional database.
- Real payment, refunds, creator withdrawals, search/ranking, automated abuse enforcement, object storage, and mobile app packaging remain future work.
- The codebase is AGPL-3.0. Hosted modifications should be reviewed for license compliance before commercial launch.

## Resources

- GitHub: <https://github.com/SillyTavern/SillyTavern>
- Docs: <https://docs.sillytavern.app/>
- Discord: <https://discord.gg/sillytavern>
- Reddit: <https://reddit.com/r/SillyTavernAI>

## License

AGPL-3.0
