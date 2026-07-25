<p align="center">
  <img src="posapp/public/favicon.svg" width="72" height="72" alt="Easy POS logo" />
</p>

<h1 align="center">Easy POS</h1>

<p align="center">
  A modern, open-source Point of Sale (POS) system for ERPNext / Frappe — built with React.
</p>

<p align="center">
  <a href="https://github.com/aashishvashisht6/EasyPOS/actions/workflows/ci.yml"><img src="https://github.com/aashishvashisht6/EasyPOS/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://github.com/aashishvashisht6/EasyPOS/actions/workflows/linter.yml"><img src="https://github.com/aashishvashisht6/EasyPOS/actions/workflows/linter.yml/badge.svg" alt="Linters"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT"></a>
  <img src="https://img.shields.io/badge/Frappe-Framework-0089FF" alt="Frappe Framework">
</p>

<!--
TODO: fill in / expand this section with your own words — intro, screenshots,
and any additional context you want future readers to have.
-->

## Introduction

**Easy POS** is a free, open-source Point of Sale (POS) application for **ERPNext and the Frappe Framework**, built as a modern React 19 single-page app (`posapp/`) and packaged as an installable Frappe app (`easy_pos`). It replaces the standard ERPNext POS screen with a purpose-built retail checkout experience — a fast cart-and-payment terminal, shift-based cash management, invoice and returns handling, and admin screens for POS Profiles, Price Lists, and Discounts — while reusing ERPNext's own **Sales Invoice**, **Customer**, and **POS Profile** doctypes as the system of record, so there is no separate database to keep in sync.

The project targets small and mid-size retail counters — shops, cafés, and multi-terminal stores already running ERPNext — that want a snappier, cashier-friendly POS UI without abandoning their existing accounting, inventory, and reporting stack. It is being built out in stages toward a fully **offline-first Progressive Web App**: today's release covers the full online checkout-to-close workflow plus an installable PWA app shell (see [Features](#features)); RxDB-backed local storage, offline invoice queueing, and background sync are the next milestones on the [roadmap](#roadmap).

## Features

### 🧾 Checkout & Sales
- **POS Terminal** — cart-based checkout with live item search, quantity/rate editing, line and invoice-level discounts, and multi-mode (split) payments in one screen
- **Barcode scanning** — scan with a USB/Bluetooth hardware scanner (keyboard-wedge input, works anywhere on the Terminal without clicking into the search box first) or the device camera; both resolve against item barcode/serial/batch/item code and auto-add a unique match straight to the cart
- **Held / draft sales** — park an in-progress cart as a Draft invoice and pull it back into the terminal later via the draft picker, so a cashier can serve another customer without losing a sale
- **Product Bundles** — add an ERPNext Product Bundle straight from the item grid like any other item; the terminal flags it with a bundle badge and previews its components in the cart, while ERPNext itself explodes it into the invoice's packed items and deducts component stock on checkout

### 🏷️ Pricing & Discounts
- **Discounts (Pricing Rules)** — a dedicated admin screen (list + editor) for ERPNext Pricing Rules: percentage discounts, flat-amount discounts, and free-item ("Buy X Get Y") rules, scoped by item/item group/brand, customer/customer group, min/max qty or amount, priority, and validity dates — applied automatically to the cart, on top of manual per-cart overrides
- **Item Prices** — a dedicated list + editor for individual Item Price records (item, price list, rate, currency, valid-from/upto) used to price cart lines
- **Price Lists** — manage the Price List records themselves (selling/buying, currency, enabled state) that Item Prices and the cart price against, independent of discount rules

### 🎁 Loyalty Program
- **Loyalty Program admin** — create and edit ERPNext Loyalty Programs (list + detail editor): program type, conversion factor (currency-per-point), qualifying customer group, expiry/validity window, and tiered collection rules
- **Points earn & redeem in-cart** — the Cart shows the selected customer's enrolled program and live points balance; at payment, a cashier can redeem points toward the invoice total, capped at the customer's balance and the amount the grand total can actually absorb (mirrors ERPNext's own `validate_loyalty_points` check), with the redeemed amount broken out separately in the payment summary

### 🧮 Invoices & Returns
- **Invoice Register** — a searchable, filterable, paginated list of all POS Sales Invoices with status badges (Paid, Overdue, Draft, Return, ...)
- **Invoice detail view** — itemized line view, taxes and charges, additional discounts, and payment breakdown for any invoice
- **Cancel invoice** — cancel a submitted invoice with confirmation
- **Credit notes / returns** — issue a return against any non-return invoice; the backend recomputes taxes and totals against the return's own negative net total rather than trusting client math, and the resulting credit note carries the original invoice's POS profile and shift so it stays visible in reporting
- **Customer purchase history** — jump straight from the cart's selected customer to their filtered Invoice Register, one click, no separate history screen to maintain

### 👥 Customers
- Searchable, paginated customer directory with quick-create for walk-in and repeat customers, wired straight into the cart, including loyalty program enrollment and points balance

### 🧑‍💼 Shift Management
- **Opening Entry** — start a shift by declaring an opening cash balance per payment mode, scoped to the cashier and POS Profile
- **Closing Entry** — reconcile counted vs. expected cash at end-of-shift, per payment mode, with each mode independently configurable as auto-calculated or manually counted
- Every sale, return, and closing figure is scoped to the shift it happened in (not just the POS Profile), so numbers can't leak across shifts sharing the same till

### ⚙️ Administration
- **POS Profile editor** — full CRUD editor for POS Profiles, including their `payments` child table (available payment modes) and the auto/manual closing behavior per mode
- **Settings hub** — a landing page for secondary/admin screens that don't warrant their own sidebar icon (currently Loyalty Program, with user management planned)

### 🔌 Frappe-Native by Design
- Runs as a standard Frappe app (`bench get-app` / `bench install-app`) — no external services or databases to stand up
- Talks to Frappe over thin, purpose-built whitelisted API methods (`easy_pos/api/*.py`) rather than raw REST calls, keeping business logic (tax/total recalculation, shift scoping, permission checks) on the server where ERPNext already enforces it
- Every screen reuses ERPNext's real doctypes end-to-end, so invoices, customers, and stock movements created through Easy POS show up natively in ERPNext's own reports and ledgers

### 📲 Installable PWA
- Install Easy POS on a till/tablet/desktop like a native app — standalone window, home-screen/app-list icon, custom splash screen
- The app shell (JS/CSS/icons) is precached by a service worker for instant repeat loads, with a prompt-to-reload banner when a new version is deployed — never a silent mid-transaction reload
- Transactional data and API calls are always fetched live (cookie-based auth, shared-terminal safe) — this covers installability and static-asset caching only, not full offline operation (see [Roadmap](#roadmap))

## Roadmap

Easy POS is being delivered in stages toward a fully offline-capable PWA. Shipped so far covers login, shift open/close, the sales terminal with split payments and barcode scanning (hardware + camera), Pricing Rule discounts, Price Lists, a Loyalty Program with in-cart points redemption, invoice register, returns, and installable-PWA app shell caching. Still ahead:

- **Offline core** — RxDB (IndexedDB) local storage, offline PIN login, and an offline invoice mutation queue so the terminal keeps working through a dropped connection
- **Sync visibility** — a background sync engine with a dedicated screen (scaffolded today as a UI preview on the Sync page) showing pending changes, conflicts, and cache freshness per doctype
- **Reporting & hardware** — X/Z shift reports and cash-drawer triggering

See [`docs/UPCOMING_FEATURES.md`](docs/UPCOMING_FEATURES.md) for the full, itemized backlog beyond this roadmap (receipt delivery, split bill, manager-approval PINs, item variants, and more).

## Screenshots

<!-- Add real screenshots to the screenshots/ folder using the filenames below — see screenshots/README.md -->

| Login | Terminal |
| --- | --- |
| ![Login screen](screenshots/login.png) | ![POS Terminal](screenshots/terminal.png) |

| Invoices | Closing |
| --- | --- |
| ![Invoice register](screenshots/invoices.png) | ![Shift closing](screenshots/closing.png) |

## Setup

### Install the app

```bash
cd $PATH_TO_YOUR_BENCH
bench get-app https://github.com/aashishvashisht6/EasyPOS --branch develop
bench install-app easy_pos
```

### Frontend development

```bash
cd posapp
yarn install
yarn dev      # start the Vite dev server
yarn build    # production build; also copies built HTML into the Frappe app
```

## How to Use

1. **Sign in** at `/posapp` with your workstation credentials.
2. **Open a shift** — enter your opening cash balances per payment mode to start a POS Opening Entry.
3. **Ring up sales** on the Terminal — search items, adjust quantities/discounts, and take payment across one or more modes.
4. **Manage invoices** — view, cancel, or issue a credit note (return) from the Invoices page.
5. **Close your shift** — reconcile counted cash against expected totals per payment mode and submit the closing entry.

## Dependencies

**Frontend** (`posapp/`)
- React 19, React Router 7
- Zustand 5 (global state)
- Bootstrap 5 + Bootstrap Icons
- Vite 7
- @zxing/browser (camera barcode/QR scanning)

**Backend**
- Frappe Framework
- ERPNext (Sales Invoice, Customer, POS Profile doctypes)

## Contributing

This app uses `pre-commit` for code formatting and linting. Please [install pre-commit](https://pre-commit.com/#installation) and enable it for this repository:

```bash
cd apps/easy_pos
pre-commit install
```

Pre-commit is configured to use the following tools for checking and formatting your code:

- ruff
- eslint
- prettier
- pyupgrade

For frontend-only changes, also run `cd posapp && npx eslint .` before committing.

### CI

This app uses GitHub Actions for CI:

- **CI** — installs this app and runs unit tests on every push to `develop`.
- **Linters** — runs [Frappe Semgrep Rules](https://github.com/frappe/semgrep-rules) and [pip-audit](https://pypi.org/project/pip-audit/) on every pull request.

## Bugs and Feature Requests

Found a bug or have an idea? Please open an issue using one of the templates:

- [🐛 Report a bug](https://github.com/aashishvashisht6/EasyPOS/issues/new?template=bug_report.md)
- [✨ Request a feature](https://github.com/aashishvashisht6/EasyPOS/issues/new?template=feature_request.md)

## License

MIT — see [LICENSE](LICENSE).
