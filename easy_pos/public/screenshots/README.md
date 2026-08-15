# Screenshots

Real screenshots of every major Easy POS screen. Lives under `easy_pos/public/`, so on a running site
these are served as static assets at `/assets/easy_pos/screenshots/<file>.png` (no Frappe File-doctype
uploads needed) — that's the path used by every `/docs` Wiki page embed. The root `README.md` links to
this same folder using a repo-relative path instead, since GitHub renders those directly.

Recommended when adding more: PNG, ~1280px wide, no real customer/transaction data — and check for any
personal data (emails, phone numbers) visible in the shot before adding it, since these are public.

| Filename | Screen |
| --- | --- |
| `login.png` | Login / sign-in screen |
| `terminal.png` | POS Terminal (cart + checkout) |
| `opening-entry.png` | Opening Entry modal ("Open your till") |
| `closing.png` | Shift Closing modal ("Close your till") |
| `barcode-scan.png` | Camera barcode scanner modal on the Terminal |
| `variant-picker.png` | Item variant picker modal |
| `invoice-detail.png` | Invoice detail view |
| `credit-note.png` | Create Credit Note modal |
| `customers.png` | Customer directory list |
| `customer-detail.png` | Customer detail page |
| `pos-profile-list.png` | POS Profile list |
| `pos-profile-detail.png` | POS Profile editor (Payments table) — **user emails redacted, keep it that way in any replacement** |
| `discounts.png` | Discounts (Pricing Rules) list |
| `item-price.png` | Item Price list |
| `price-list.png` | Price List list |
| `loyalty-program.png` | Loyalty Program list |
| `reports.png` | Reports & Cashier Dashboard |
| `receipt-delivery.png` | Printed / emailed receipt preview |
| `customer-display.png` | Customer-facing second screen (cart mirror / thank-you view) |
| `dark-mode.png` | Terminal in dark theme |
| `sync-preview.png` | Sync page (preview, not a shipped feature — label it as such wherever it's used) |
| `settings.png` | Settings landing page |
| `pwa-install.png` | Browser install prompt for the PWA |

## Not currently used anywhere

`invoices.png` (a plain Invoice Register list screenshot, distinct from `invoice-detail.png`) was dropped
in an earlier pass and never recaptured — add it back under this name if you want the Invoices page to
have a list-view hero image again.

## Adding more later

Drop new files in here with a clear name, tell me which ones landed, and I'll wire each one into the
matching `/docs` Wiki page via its `/assets/easy_pos/screenshots/<file>.png` path.
