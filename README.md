# ContractorOS

Mobile-first estimating MVP for small contractors in the United States. Built with Next.js, TypeScript, Tailwind CSS, Supabase Auth, PostgreSQL, and Row Level Security.

## Included

- Email/password sign up, login, password reset, and logout
- Required company onboarding with logo upload and estimating defaults
- Customer CRUD with multiple job sites
- Rate Library create/edit/duplicate/delete with search, category filters, sample services, and estimate autofill
- Professional estimate builder with multiple reorderable/duplicable line items, per-unit labor, private costing, live margin, six statuses, discount, tax, and deposit
- Secure customer estimate links with view tracking, approve/decline, touch signature, immutable approval snapshot, and Letter-size PDF styling
- Change Orders linked to approved estimates with customer approval, signatures, snapshots, and updated contract value
- Estimate activity timeline for sent, viewed, approved, rejected, expired, and change-order events
- Dashboard metrics and recent activity
- Owner-scoped PostgreSQL RLS on every business table

Invoices, payments, reports, projects, and AI are intentionally excluded from this MVP.

## Local setup

1. Create a Supabase project.
2. Run the migrations in filename order in the Supabase SQL Editor (or with the Supabase CLI):
   - `supabase/migrations/20260902000000_initial_schema.sql`
   - `supabase/migrations/20260903000000_estimate_builder_rate_library.sql`
   - `supabase/migrations/20260903010000_customer_approvals_change_orders.sql`
   - `supabase/migrations/20260904000000_preserve_view_count_on_approval.sql`
3. Copy `.env.example` to `.env.local` and add the project URL and anon key.
4. Add `NEXT_PUBLIC_SITE_URL=http://localhost:3000` to `.env.local`.
5. In Supabase Auth URL Configuration, add `http://localhost:3000/auth/callback` as a redirect URL.
6. Run `npm install`, then `npm run dev`.

## Production setup

Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `NEXT_PUBLIC_SITE_URL` in the hosting environment. Add `https://your-domain.com/auth/callback` to Supabase Auth redirect URLs.

The migration creates the public `company-logos` bucket with owner-only write policies and public reads so logos render in printed customer estimates.

## Calculation rules

The browser provides immediate feedback and PostgreSQL recomputes labor totals and generated cost columns. Material uses adjusted quantity, total labor hours use quantity × hours per unit, overhead applies to direct cost, and profit markup applies after overhead. Tax applies only to taxable line items; discounts reduce the taxable base proportionally. Currency is rounded to two decimals and invalid/negative inputs are clamped before calculation.

The estimating upgrade automatically adds eight fictional sample services to each company. They are marked as sample data and must be replaced with the contractor's own local costs and pricing.

## Customer approval security

Customer links use unique random UUID tokens and work without authentication. Anonymous users do not receive table access. Public pages call narrowly scoped PostgreSQL functions that construct an allowlisted JSON document containing only customer-facing fields. A second application guard rejects any payload containing internal-cost, labor-rate, overhead, markup, margin, internal-description, or internal-notes keys.

Approval and decline operations are rate-limited per public token and IP for ten-minute windows. Approvals record the signer, email, signature method/data, timestamp, user agent, and server-observed IP when available; IP is supporting audit metadata and is never the basis for signature validity. Approved estimates and Change Orders receive immutable customer-safe snapshots, and database triggers block later silent edits.

PDF downloads use the browser's native print-to-PDF workflow with US Letter print styling. No paid email provider is required: contractors send estimates using the copyable customer link. The action layer is intentionally separated so transactional email can be added later.

Change Order contract value is `original approved estimate + previously approved change orders + current change order`. Tax applies only to taxable Change Order items.

## Validation

```bash
npm run typecheck
npm run lint
npm run test:calculations
npm run build
```

Live authentication and RLS checks require a configured Supabase project. Validate with two test accounts: create one company and customer under each account, then confirm each account can only query and mutate its own records.
