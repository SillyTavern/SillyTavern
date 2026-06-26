# SillyTavern

LLM Frontend for Power Users

## Hosted AI Tavern MVP

This branch adds a hosted AI tavern marketplace and wallet MVP on top of SillyTavern. It is aimed at a web/PWA-first product where users can open the app, browse or upload content, buy or claim assets with coins, and install assets into their private SillyTavern data space without deploying their own server.

### Marketplace And Wallet

- Built-in `marketplace-wallet` extension in the Extensions panel.
- Wallet balances split into `bonus`, `paid`, and `earnings` buckets.
- Immutable wallet ledger for grants, purchases, debits, and creator earnings.
- Marketplace assets for character cards and world books.
- Creator upload flow for draft assets, JSON payload validation, and submit-for-review.
- Creator Center summary for owned assets, review status counts, claims, installs, and earned coins.
- Installable PWA shell for mobile browsers using the existing web app and static shell cache.
- Admin review queue with inspect/approve/reject actions.
- Admin delist action to remove listed assets from public purchase while preserving existing entitlements.
- User report action and admin report queue with resolve workflow for marketplace moderation.
- Admin coin grants for `bonus`, `paid`, and `earnings`.
- Free and fixed-price purchase flow with `bonus -> paid` spending order.
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

Start the app:

```bash
npm start
```

Open `http://127.0.0.1:8000` and use the Extensions panel to find `Marketplace & Wallet`.

The local MVP APIs live under `/api/market` and `/api/wallet`. Creator Center uses `GET /api/market/creator/summary`; full wallet balances and ledger history remain available through `/api/wallet` and `/api/wallet/ledger`.

On mobile, open the same URL in a browser and use the browser's Add to Home Screen / Install action. The PWA service worker caches only the static shell and never caches `/api/*` wallet, market, or chat requests.

### Useful Scripts

```bash
# Start the app
npm start

# Start with CSRF disabled for local API smoke testing
npm run start:no-csrf

# Run marketplace/wallet backend and frontend-contract tests
npm run test:marketplace

# Run only the mobile/PWA shell contract test
npm run test:pwa

# Run marketplace/wallet browser E2E tests
# Requires Playwright browsers:
#   tests/node_modules/.bin/playwright install chromium-headless-shell
npm run test:marketplace:e2e

# Run the existing test package suites
npm --prefix tests run test:unit
npm --prefix tests run test:e2e
```

### Development Notes

- The MVP still uses JSON/node-persist storage and is intended for local validation, not production SaaS scale.
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
