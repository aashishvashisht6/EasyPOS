## Summary

Make the whole POS app (`posapp/`) usable on phones (< 640px). Today it supports tablets and desktops only: a fixed 64px icon rail, a single-row topbar, and a side-by-side Items | Cart terminal that cannot fit a phone. This issue tracks a phased rollout; each phase ships as its own PR and is independently reviewable.

## Decisions

- **Terminal layout on mobile: "items + cart sheet".** The item grid is full-screen. A sticky bar above the bottom nav shows `N items · total` and opens the cart as a bottom sheet. (Rejected: Items/Cart tabs; the cashier loses sight of the running total while browsing.)
- **Breakpoints:** mobile `< 640px`, tablet `640–1023px`, desktop `>= 1024px`. Tablet and desktop layouts must not change.
- **Navigation on mobile:** bottom tab bar (Terminal, Invoices, Customers, Reports, More). "More" opens a sheet with the remaining `NAV_ITEMS`.

## Current state (audit)

| Area | Problem |
|---|---|
| `AppLayout.jsx` | `height: 100vh`; on mobile browsers this is taller than the visible area, hiding the bottom behind browser chrome |
| `Sidebar` | fixed 64px rail with 10 icons; eats width and overflows vertically |
| `Topbar` | title, search, scan, status pills, language, theme, avatar in one 56px row |
| `POSTerminalPage` | flex row of `Items` and `Cart`; `Cart/style.css` only sizes the cart from 600px up |
| `Cart/index.jsx` | line rows use inline `minWidth` 110/130/200 |
| `ListTable` | `fr` grid with up to 8 columns; text collides on a phone |
| `ChildTable` | `minWidth >= 480`; scrolls horizontally |
| `Modal` | Bootstrap centered dialog, `lg` sizes cramped |
| Controls | many `size="sm"` fields and 28–34px icon buttons, below the 44px touch guideline |
| Media queries | one layout query exists (login card, 720px) |

Already fine: viewport meta, `standalone` PWA manifest, `Items` grid adapts via `containerWidth` (min 2 columns), several editor pages use `col-6 col-md-4`.

## Constraints (from CLAUDE.md)

- Use logical CSS properties only (`inset-inline-start`, `margin-inline-*`, ...) so RTL (Arabic, Persian) keeps working.
- Use `var(--color-*)` tokens only; verify every phase in dark mode.
- Reuse `common/*` primitives; add new shared pieces to `common/index.js`.
- New `setTopbar` keys must be added to `DEFAULT_TOPBAR` **and** forwarded in `<Topbar />` in `AppLayout.jsx`.
- `window.open()` for receipts must stay synchronous inside the click handler; do not move it into async callbacks during sheet refactors.
- New strings go through `__()` / `_t()`; regenerate the `.pot` and fill `.po` files.

## Plan

### Phase 0 – Foundations
- [ ] Breakpoint tokens in `theme/tokens.css`; `hooks/useIsMobile.js` (`matchMedia`, SSR-safe).
- [ ] `AppLayout`: `100vh` -> `100dvh`; safe-area insets (`env(safe-area-inset-*)`).
- [ ] Global mobile rules: `touch-action: manipulation`, min 44px control height, 16px input font size (stops iOS focus-zoom).

### Phase 1 – Shell
- [ ] `Sidebar`: hide the rail below 640px; new bottom tab bar driven by the same `NAV_ITEMS`; "More" sheet; keep the pending-sync badge on Sync.
- [ ] `Topbar`: compact two-row layout; search full width on row two; status pills collapse to a dot; language/theme move into the avatar menu.
- [ ] Add reusable `common/BottomSheet` (backdrop, drag handle, `dvh`-aware max height, focus trap, Escape/back closes).

### Phase 2 – POS Terminal
- [ ] `POSTerminalPage`: on mobile render only `Items` plus a sticky `CartBar`; `Cart` renders inside `BottomSheet`.
- [ ] `CartBar` (`N items · total · View cart`), uses `useCurrencyFormatter`.
- [ ] Cart line rows stack vertically; remove inline `minWidth`s.
- [ ] `InvoicePay`, `Closing`, `OpeningEntryModal`, variant and draft modals go full-screen on mobile with sticky footers.
- [ ] Hide the "Customer Display" button on mobile.
- [ ] Verify scan flows (hardware scanner hook, camera modal) and the Items virtualized grid (`CARD_HEIGHT`, absolute rows) on small widths.
- [ ] Keyboard handling: cart footer and Pay button stay visible when the on-screen keyboard opens.

### Phase 3 – Shared components
- [ ] `Modal`: full-screen below 640px, sticky footer; optional `bottomSheet` variant.
- [ ] `ListTable`: stacked card rows below 640px; per-column `mobile: "primary" | "secondary" | "hide"` hint, defaulting to first two columns plus status.
- [ ] `ChildTable`: keep horizontal scroll; card mode for tables with 6+ columns.
- [ ] `PageHeader` actions wrap/collapse; `Pagination` and `FilterChips` scroll horizontally; `.pos-inline-fields` stacks.

### Phase 4 – Pages
- [ ] List pages (Invoices, Customers, POS Profiles, Price Lists, Item Prices, Discounts, Loyalty): filters collapse behind a "Filters" button opening a sheet.
- [ ] Detail/editor pages (POS Profile, Discount, Customer, Price List, Item Price, Loyalty): single column, `col-12 col-sm-6` grids, sticky bottom Save bar.
- [ ] `InvoiceDetailPage`, `ReportsPage` (2-col KPI tiles, charts 1 column, check `Chart.jsx` resize), `SettingsPage`, `SyncPage`.

### Phase 5 – PWA and polish
- [ ] Manifest: `orientation: "any"`, terminal shortcut.
- [ ] Test service worker + add-to-home-screen on iOS Safari and Android Chrome.
- [ ] Pull-to-refresh vs. inner scroll in standalone mode; landscape phone (844px) pass.

## Acceptance criteria

- No horizontal page scroll on any route at 360, 390 and 430px (`document.documentElement.scrollWidth <= innerWidth`).
- A full sale (search/scan -> cart -> customer -> pay -> receipt) is completable one-handed on a 390px phone.
- All tap targets >= 44px on mobile; no iOS focus-zoom on inputs.
- Tablet (768/1024) and desktop layouts are visually unchanged.
- Dark mode and RTL (Arabic) checked for every phase.
- `npx eslint` clean on all edited files.

## Testing

- `resize_window` mobile preset and `getBoundingClientRect` overflow checks per page.
- A scripted route sweep asserting no horizontal overflow.
- Real device (LAN dev server or iOS Simulator) for `dvh`, keyboard, safe-area and PWA behaviour; desktop emulation misses these.

## Risks

- Virtualized item grid uses fixed row height and absolute positioning.
- Bootstrap CSS is owned by `theme/bootstrapDirection.js`; mobile overrides go in `components.css`, not Bootstrap.
- Closing and Customer Display were designed around a till; treat as best-effort on mobile.
- Phase 4 touches many files but is mostly mechanical once Phase 3 lands.

## Suggested PR breakdown

One PR per phase, in order. Phases 0–2 deliver a usable mobile terminal; 3–5 are follow-ups.
