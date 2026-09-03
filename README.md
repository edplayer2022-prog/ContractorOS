# ContractorOS

Mobile-first estimating MVP for small contractors in the United States. Built with Next.js, TypeScript, Tailwind CSS, Supabase Auth, PostgreSQL, and Row Level Security.

## Included

- Email/password sign up, login, password reset, and logout
- Required company onboarding with logo upload and estimating defaults
- Customer CRUD with multiple job sites
- Rate Library create/edit/duplicate/delete with search, category filters, sample services, and estimate autofill
- Professional estimate builder with multiple reorderable/duplicable line items, per-unit labor, private costing, live margin, six statuses, discount, tax, and deposit
- Customer-safe estimate view with Letter-size print/PDF styling
- Dashboard metrics and recent activity
- Owner-scoped PostgreSQL RLS on every business table

Invoices, payments, reports, projects, and AI are intentionally excluded from this MVP.

## Local setup

1. Create a Supabase project.
2. Run the migrations in filename order in the Supabase SQL Editor (or with the Supabase CLI):
   - `supabase/migrations/20260902000000_initial_schema.sql`
   - `supabase/migrations/20260903000000_estimate_builder_rate_library.sql`
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

## Validation

```bash
npm run typecheck
npm run lint
npm run test:calculations
npm run build
```

Live authentication and RLS checks require a configured Supabase project. Validate with two test accounts: create one company and customer under each account, then confirm each account can only query and mutate its own records.
