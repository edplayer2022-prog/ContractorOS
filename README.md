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
- Approved estimate conversion to Projects with contract, invoicing, payment, profitability, and actual-cost summaries
- Deposit, progress, final, and custom invoices with secure customer links and Letter-size PDF styling
- Manual payments, protected overpayment confirmation, payment void history, and printable receipts
- Project costs, estimated-vs-actual tracking, overdue invoice indicators, and financial audit events
- Estimate activity timeline for sent, viewed, approved, rejected, expired, and change-order events
- Dashboard metrics and recent activity
- Executive dashboard with period comparisons, revenue trend, and financial KPIs
- Sales, estimates, projects, invoices, AR aging, payments, profitability, and customer reports
- Company-local date filters, project health rules, cost budget variance, CSV export, and print-friendly reports
- Owner-scoped PostgreSQL RLS on every business table

Live payment processing, accounting integrations, teams, subscription billing, payroll, and AI are intentionally excluded from this version.

## Local setup

1. Create a Supabase project.
2. Run the migrations in filename order in the Supabase SQL Editor (or with the Supabase CLI):
   - `supabase/migrations/20260902000000_initial_schema.sql`
   - `supabase/migrations/20260903000000_estimate_builder_rate_library.sql`
   - `supabase/migrations/20260903010000_customer_approvals_change_orders.sql`
   - `supabase/migrations/20260904000000_preserve_view_count_on_approval.sql`
   - `supabase/migrations/20260905000000_projects_invoices_payments.sql`
   - `supabase/migrations/20260905010000_financial_write_hardening.sql`
   - `supabase/migrations/20260906000000_reporting_analytics.sql`
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

## Projects, invoices, and payments

Only approved estimates can create projects or invoices. Current contract value is the approved estimate total plus approved Change Orders. Draft, sent, viewed, and rejected Change Orders never affect the contract value. Deposit invoices use the estimate deposit percentage, final invoices use the remaining billable contract value, and PostgreSQL blocks accidental overbilling unless the contractor explicitly confirms it.

Payments are manual records only; ContractorOS does not process money. Active payments determine amount paid and balance due. Overpayments require explicit confirmation and are preserved separately, while voided payments remain in history and trigger a full invoice recalculation.

Public invoice links use revocable UUID tokens and a customer-safe PostgreSQL projection. They never expose internal notes, costs, overhead, markup, profit, or margin.

## Reporting rules

Dashboard and Reports date ranges use the company IANA timezone. Approval rate is `approved / (approved + rejected + expired)` and safely returns zero when no estimate is eligible. Cancelled projects are excluded from principal profitability metrics. AR aging includes only non-void invoices with an outstanding balance and uses Current, 1–30, 31–60, 61–90, and 90+ day buckets.

Project health is deterministic: Healthy means projected margin remains within three percentage points of estimated margin; Watch means actual costs reached 85% of estimated cost or margin moved beyond that tolerance; At Risk means actual cost exceeds estimated cost or projected profit is negative. CSV downloads execute on the server with the authenticated Supabase session and inherit company-scoped RLS.

## Validation

```bash
npm run typecheck
npm run lint
npm run test:calculations
npm run build
```

Live authentication and RLS checks require a configured Supabase project. Validate with two test accounts: create one company and customer under each account, then confirm each account can only query and mutate its own records.
