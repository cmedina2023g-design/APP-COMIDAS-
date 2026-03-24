# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All commands run from the `app/` directory:

```bash
npm run dev      # Development server (Turbopack disabled)
npm run build    # Production build
npm run start    # Start production server
npm run lint     # ESLint 9
```

> Turbopack is explicitly disabled via `NEXT_DISABLE_TURBOPACK=1` in the dev script to avoid macOS path-with-spaces compatibility issues.

## Environment

Requires a `.env.local` with Supabase credentials:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Architecture

**Stack:** Next.js 15 App Router + React 19 + TypeScript (strict) + Supabase (PostgreSQL + Auth) + Tailwind CSS 4 + shadcn/ui

**Path alias:** `@/*` maps to `src/*`

### Data Flow

```
UI Components → Custom Hooks → React Query → Supabase Client → PostgreSQL (RPCs/RLS)
                             ↘ Zustand (cart only)
```

- **Custom hooks** (`src/hooks/`) own all data fetching and mutations via React Query
- **Zustand** (`src/lib/store/cart.ts`) handles only client-side cart state
- **Supabase RPCs** handle complex atomic operations — do not replicate this logic in the client

### Route Structure

- `(auth)/` — Public routes (login)
- `(dashboard)/` — Protected routes; guarded by `src/middleware.ts`
- `admin/` — Admin-only features (sales voiding, finance)

### Critical Database Functions

These PostgreSQL RPCs must stay in sync with any schema changes:

| RPC | Purpose |
|-----|---------|
| `create_sale()` | Atomic sale creation + inventory deduction |
| `void_sale()` | Admin-only safe sale reversal + inventory restoration |
| `get_products_with_available_units()` | Calculates real-time product availability from stock |

All tables use Row Level Security (RLS) scoped to `org_id` for multi-tenancy.

### Inventory System

Products have recipe-based inventory deduction. The hierarchy is:

```
Product → product_recipes (ingredients)
        → product_modifier_groups → product_modifiers → modifier_recipes (ingredients)
```

When a sale is created, inventory is deducted for both the base product recipe and any selected modifier recipes. The `void_sale` RPC reverses this precisely.

### User Roles

`ADMIN`, `VENDEDOR` (seller), `RUNNER` (delivery). Roles are stored in `profiles.role` and enforced at both RLS and UI levels.

### Supabase Client Usage

- **Browser components:** `src/lib/supabase/client.ts`
- **Server components / middleware:** `src/lib/supabase/server.ts`

Never use the browser client in Server Components or middleware.

### Key Type Definitions

Central types live in `src/lib/types.ts`. The modifier system types (`ProductModifierGroup`, `ProductModifier`, `ModifierRecipe`) are complex — read this file before working with product/modifier logic.

### shadcn/ui

Style: `new-york`, base color: `neutral`, icon library: `lucide`. Add components via `npx shadcn@latest add <component>`.

---

## Business Rules & UX Decisions (post pre-launch review)

### POS — Overpayment
- The Cobrar button enables when `remainingAmount <= 0` (payment ≥ total), not just when exact.
- When `remainingAmount < 0`, the label changes to **"Cambio"** (green), not "Restante".
- `handleCheckout` validates `remainingAmount > 0`, allowing overpayment.

### Stock / Inventory Display
- The RPC `get_products_with_available_units` returns `999999` (not null) for products without recipes. Treat `>= 999999` as "no tracking". The RPC never returns null — always a number.
- Badge logic in `src/components/pos/product-grid.tsx`:
  - `available_units >= 999999` → **"Sin receta"** yellow badge, button enabled
  - `available_units < 0` → **negative number** red badge, button enabled
  - `available_units === 0` → **"Sin stock"** red badge, button enabled
  - `available_units 1–4` → **number** orange badge, button enabled
  - `available_units >= 5` → **number** gray badge, button enabled
- **Products are NEVER disabled in POS regardless of stock.** Inventory is not updated daily — blocking sales on stale data is unacceptable. All badges are informational only.
- Negative stock is valid and expected. Display it as-is (red). Do not clamp to 0 in the UI.
- After a sale, `useCreateSale.onSuccess` must invalidate `['products-with-stock']` so badges update immediately without page reload.

### Sales History Filter
- `useSalesHistory(filters?)` accepts optional `{ startDate, endDate }` ISO strings.
- Query key is `['sales-history', filters]` — invalidation by prefix still works in `useVoidSale`.
- Default view: today only (set in `admin/sales/page.tsx`).

### Modifier Groups
- Validate `max_selections >= min_selections` before saving in `product-dialog.tsx`.
- Show red border on min/max inputs when invalid.

### User Management
- `useToggleProfileActive()` in `use-profiles.ts` toggles `profiles.active` field.
- Password field in create-user form must be `type="password"` (not text).

### Shifts
- `ShiftCard` uses `useEffect` to sync local state from server props (prevents stale display after navigation).

### Time Format
- All time displays use 24h (`hour12: false` in `toLocaleTimeString`, `HH:mm` in `date-fns` format).

### Product Type
- `Product` in `src/lib/types.ts` includes optional `modifier_groups?: ProductModifierGroup[]`.
- This field is populated by `useProductsWithStock()` via a separate query joined client-side.

### Modifier Recipes & Inventory Deduction
- The `create_sale` RPC handles TWO levels of inventory deduction: base product recipe + modifier recipes.
- Frontend payload (`src/hooks/use-sales.ts`): each item in `p_items` must include:
  ```json
  { "product_id": "...", "qty": 1, "unit_price": 12000,
    "modifiers": [{ "modifier_id": "...", "modifier_name": "ARROZ", "extra_price": 0 }] }
  ```
- Modifier objects in the Zustand cart (`src/lib/store/cart.ts`) use field `name` (not `modifier_name`). The mapping in `use-sales.ts` uses `m.name || m.modifier_name` to handle both.
- The updated `create_sale` RPC is in `supabase/migrations/20260319000000_fix_create_sale_modifiers.sql`. If the DB function is ever reset, re-apply this migration.
- `void_sale` RPC must also reverse modifier recipe deductions — verify if adding modifier support to void_sale is needed.

### Cart Item Structure (Zustand)
- `CartItem` in `src/lib/store/cart.ts` extends `Product` with `{ qty, cartItemId, modifiers? }`.
- `cartItemId` = `${product.id}-${modifiers_signature}` — allows same product with different modifiers as separate cart lines.
- Modifier objects in `modifiers[]`: `{ modifier_id, name, extra_price, group_name }`.

### Layout — Rules of Hooks
- `src/app/(dashboard)/layout.tsx` has an early return for `isProfileLoading`. ALL `useEffect` / `useState` / hooks must be declared BEFORE this early return. Placing hooks after a conditional return violates React's Rules of Hooks and causes a runtime error.

### Dev Server
- If `localhost:3000` stops responding (hangs, 119% CPU), kill the stuck process and remove `.next/dev/lock`:
  ```bash
  kill -9 <pid>
  rm -f .next/dev/lock
  npm run dev
  ```
