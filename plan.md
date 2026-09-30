# Stellar Gear — Admin, Inventory & Bitcoin Checkout

## Product outcomes

The public price sheet remains simple: customers choose items and see a running item total. A customer can then check out with **Bitcoin**, with **$20.00 shipping** added to every checkout. Checkout collects the customer's **name, email, phone number, and shipping address**, presents a payment QR code and the exact Bitcoin amount for the order, and returns a clear order-completion / thank-you experience once the blockchain payment is confirmed.

The `/admin` workspace remains password-protected. The owner can add items, change prices and names, set items out of stock, remove items, and maintain inventory counts.

## Architecture

- Keep the React SPA, Express/tRPC API, and managed MySQL database. The published container continues to serve the browser shell and dynamic API responses from the existing server.
- The direct Bitcoin receiver is the supplied public mainnet address `bc1q2nu28522pkqmyy20c6x32fz4evndyxc7lavmn8`. No private key, seed phrase, or wallet-control credential is stored by the application.
- On checkout submission, the server validates the live catalog and inventory, locks the product prices and fixed $20.00 shipping amount, obtains the current BTC/USD reference rate from Coinbase's public exchange-rate endpoint, and generates an exact satoshi amount. A small unique satoshi suffix distinguishes active orders that share one receiving address.
- The server persists the order, customer details, item lines, quoted USD/BTC amount, opaque payment token, payment status, and matching transaction ID. It reserves known inventory atomically with order creation, preserving the existing stock-safe transaction path.
- A public status endpoint accepts only the opaque payment token; it never returns the customer's address, email, phone number, or notes. It checks the configured receiving address against Blockstream Esplora's public address transaction API. Matching an exact output marks the order **Payment received** while unconfirmed; the first confirmed block marks it **Order complete**.
- If the price or blockchain lookup is temporarily unavailable, order creation or status refresh returns a clear retry-safe error rather than guessing a value or showing a successful payment.

## Customer interface

- The price sheet keeps its clean item/quantity/total interaction and adds a clear **Checkout with Bitcoin** action that is unavailable while the cart is empty.
- The checkout form collects name, email, phone, street address, city, state/province, postal code, and optional delivery notes. It displays the item subtotal, **$20.00 shipping**, and final USD total before an order is created.
- The payment screen shows the Stellar Gear mark, order number, USD total, exact BTC amount, receiving address, a scan-ready `bitcoin:` QR code, and a copy-address action.
- While open, it refreshes payment status about every 15 seconds: **Waiting for Bitcoin** → **Payment received — confirming** → **Order complete**. The completed state is a thank-you page and names the order number.

## Admin and inventory

- The admin dashboard has a dedicated password gate, a secure short-lived dashboard session, catalog controls, availability filters, inventory totals, and item editor.
- Known inventory is checked and deducted inside the existing transaction. Zero inventory or a hidden item is visibly out of stock and cannot be purchased.

## Project structure

- `server/bitcoin.ts` — public receiving address, exact-satoshi quote logic, Bitcoin URI helper, and blockchain transaction matching.
- `drizzle/schema.ts` / `server/db.ts` — quoted Bitcoin payment fields, opaque lookup token, payment state, and atomic checkout persistence.
- `server/routers.ts` — customer checkout creation and privacy-safe payment status procedures.
- `client/src/pages/Home.tsx` — price-sheet checkout form and cart hand-off.
- `client/src/pages/BitcoinCheckout.tsx` — payment instructions, QR code, live status, and thank-you state.
- `client/src/App.tsx` / `client/public/manus-routes.json` — checkout route declaration.
- `client/src/index.css` — responsive checkout and payment-status styling matching the black, red, and chrome Stellar Gear identity.

## Delivery and cache policy

The current SPA plus Express server deployment remains in place. The browser application shell and versioned static assets stay cacheable according to the existing build output. All `/api/trpc/*` checkout, customer, admin, payment-status, and blockchain-backed responses are dynamic and must remain private/no-store; they are not eligible for shared caching. The new browser route `/checkout/:paymentToken` remains an SPA route and requires no server-side public HTML or SEO work.

## Verification

Run the TypeScript check, payment and inventory tests, production build, migration, and targeted live API checks using non-sensitive test data. An independent read-only validation reviews cart-to-order totals, the fixed shipping amount, privacy-safe token status lookup, exact-output matching, payment state transitions, and the payment UI contract before delivery.
