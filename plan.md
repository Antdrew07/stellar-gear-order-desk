# Stellar Gear — Admin & Inventory Extension

## Product outcomes

The price sheet remains public and simple. The `/admin` workspace becomes a **password-protected admin dashboard** where the owner can add items, update prices, set an item out of stock, and maintain inventory counts.

## Architecture

- Keep the existing React price sheet plus Express/tRPC server and managed MySQL database.
- Add an `ADMIN_DASHBOARD_PASSWORD` protected environment secret. The password is submitted only to a public server-side sign-in procedure, compared in constant time, and never returned to the browser.
- Issue a short-lived, HTTP-only, Secure admin session cookie after a successful password check. All catalog and inventory mutations require this server-side session; the existing public catalog snapshot remains readable without it.
- Add an inventory quantity to products. Existing catalog rows retain an unknown quantity (`null`) rather than being silently changed. New items start at zero inventory and can be made available only once stocked. Effective availability is `Available` only when the manual availability toggle is on and the known count is above zero.
- Keep order submission inventory-aware: known inventory is checked and deducted inside the existing order transaction; unavailable or insufficient-stock items are rejected.

## User interface

- `/admin` begins with a password form and a clear “Back to price sheet” link.
- After sign-in, the dashboard shows total tracked units, in-stock items, out-of-stock items, and items whose inventory is not set.
- The item table includes inventory count and a visible availability status, plus an all / in-stock / out-of-stock filter.
- “Add item” and “Edit item” use the same form for name, price, optional sale price, inventory count, and availability. A zero quantity makes the item out of stock; the manual availability control supports temporarily hiding stocked products.

## Project structure

- `server/adminAuth.ts` — password comparison, signed admin cookie, and session verification.
- `server/_core/trpc.ts` / `server/routers.ts` — password-session protected procedures and sign-in/sign-out endpoints.
- `drizzle/schema.ts` / `server/db.ts` — product inventory persistence and availability-safe order handling.
- `client/src/pages/Admin.tsx` — password gate and inventory dashboard.
- `client/src/pages/Home.tsx` — public availability follows the inventory-aware product status.

## Delivery and cache policy

The existing SPA + Express API deployment remains unchanged. The public price-sheet shell uses the existing static/SPA delivery; tRPC mutations and admin-session responses continue through dynamic `/api/*` handling and are private/no-store by browser semantics because they set or require an admin cookie. No new public route is added.

## Verification

Run the project TypeScript check, existing tests, production build, schema migration, and targeted API/data checks. A read-only independent validator will review the password gate, inventory fields, effective availability, and catalog mutation path before delivery.
