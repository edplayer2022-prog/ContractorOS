# ContractorOS subscription billing

## Scope and plan policy

This layer covers the ContractorOS SaaS subscription, not money received by contractors from customers. It does not add Stripe Connect, customer card/ACH payments, AI, accounting, payroll or enterprise billing.

| Plan | Monthly list price | Active + reserved seats | Estimates/month | Main features |
| --- | --- | --- | --- | --- |
| Free | $0 | 1 | 3 | Customers, basic estimating/PDF, Rate Library, basic dashboard |
| Starter | $9.99 | 1 | Unlimited | Customer estimate links and typed approval |
| Pro | $19.99 | 3 | Unlimited | Signatures, Change Orders, Projects, Invoices, manual Payments, receipts, reports, project analytics, basic collaboration |
| Business | $39.99 | 10 | Unlimited | Pro plus advanced role/permission management |

Pro collaborators use the Admin role. Business enables selection of advanced roles. Existing roles are preserved after a downgrade; role permissions still apply, and no plan grants an Employee financial access. No annual prices or fake discounts are advertised.

## Authorization and enforcement

`lib/plans.ts` centralizes typed plan descriptions, prices, limits and role + plan resolution. The PostgreSQL `plan_feature` catalog mirrors the entitlement list. Existing `has_company_permission` now combines the original role check with subscription requirements for paid writes and reporting. The role-only helper is retained for historical read authorization and access-denied versus upgrade UX.

Subscription/usage/event tables have RLS and no authenticated/anonymous writes. Owner-only RPCs start a trial, schedule a local trial cancellation, resume that trial or request a downgrade. A downgrade request never grants a plan or claims provider confirmation. Paid state is written only through service-role-only provider RPCs after a verified webhook; returning from Checkout does not change a plan.

Additional database triggers cover direct REST writes and legacy security-definer workflows: monthly estimate creation, premium business record changes, digital approvals and membership/invitation limits. They do not rely on hiding navigation or buttons. Public historical document view tracking continues after downgrade; immutable snapshots remain protected. Reads of historical business records still require the original active-membership/role RLS.

Free/Starter dashboards avoid company financial KPIs. Premium reports lead to an upgrade screen. Historical projects/invoices show a read-only notice, while new paid-only actions are rejected by the server/database. Owner billing is at `/settings/billing`; `/pricing` is public. Admin has limited subscription data visibility at the database level, but only Owner can open the management page or billing sessions.

## Lifecycle, usage and retention

- New companies start Free. After company setup, Owner can keep Free or start a single 14-day Pro trial with no card. Trial eligibility is company-scoped and verified in PostgreSQL.
- Entitlements expire against database time at the exact trial/period/grace deadline, even without a scheduled job. A subscription refresh records the trial-expired event on subsequent activity. A pending downgrade does not prolong paid access beyond a real entitlement deadline.
- Monthly estimate usage uses UTC calendar months, independent of browser time, estimate date or a supplied creation timestamp. A subscription-row lock and atomic usage update serialize concurrent inserts. Duplicates count as new estimates; deleting an estimate does not refund usage. Rolled-back inserts do not consume usage.
- Seats include active memberships and unexpired/unrevoked/unaccepted pending invitations. Deactivated members and invalid invites do not count. Acceptance and reactivation are checked as well as invitation creation. Deactivation remains available to resolve over-limit accounts.
- Past due retains paid access for a bounded seven-day grace period. Repeated failures do not restart that grace period. After grace, effective access is Free.
- Cancellation retains access until the applicable period ends. Trial cancellation/resumption is available without Stripe. Paid cancellation and resumption require the provider. Downgrade review records a request and identifies seats to free; it does not claim a paid downgrade is scheduled when the provider has not confirmed it.
- No downgrade, cancellation or trial expiration deletes business data, memberships, audit history or report source data. Over-limit seats are shown to Owner; users are never automatically deleted.

## Existing-company migration

Every company existing at migration time receives internal `legacy_access=true`, preserving the current Business-level feature set without falsely marking it paid. This flag has no browser-editable RPC and does not expire unexpectedly. It must be reviewed deliberately by the operator before commercial migration. A verified paid subscription can replace legacy access. New companies do not receive legacy access.

New tables: `company_subscriptions`, `subscription_usage`, `subscription_events`. New indexes cover company, period, status, plan, lifecycle deadlines and event history. Existing company/member/estimate/business tables receive subscription triggers; existing actor-attributed audit logging is reused.

Migrations, in order:

1. `20260909000000_subscription_billing.sql`: tables, legacy backfill, new-company default, role + plan policy, lifecycle/usage/seat/record guards.
2. `20260909010000_subscription_provider_boundary.sql`: unique customer claim, idempotent provider event processing, stale-event rejection, private service-role write boundary.
3. `20260909020000_subscription_downgrade_requests.sql`: Owner-only downgrade review, seat requirements and explicitly unconfirmed provider requests.

## Stripe preparation — not active

No Stripe variables were found locally or in the existing Vercel environment on 2026-09-09. No payment, checkout or portal session has been created or tested against Stripe. The adapters remain disabled unless all required keys/prices exist **and** `STRIPE_BILLING_ENABLED=true`. Do not enable live billing before test-mode end-to-end validation and provider portal configuration review.

Required variables are documented in `billing.env.example`: `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, the three `STRIPE_PRICE_*_MONTHLY` IDs, `SUPABASE_SERVICE_ROLE_KEY`, and the explicit activation flag. Never expose the service-role key or Stripe secret keys via `NEXT_PUBLIC_*` variables.

Prepared endpoints:

- `POST /api/billing/checkout`: authenticated active Owner, same-origin POST, server-side allowed-plan to price-ID mapping; securely associate a company customer. No browser-supplied company ID or price ID is accepted. Existing subscriptions go to the portal instead of blindly creating another subscription.
- `POST /api/billing/portal`: active Owner only, existing company customer, fixed configured return URL.
- `POST /api/stripe/webhook`: raw-body HMAC-SHA256 verification, constant-time comparison and five-minute tolerance before parsing. Uses the canonical subscription retrieved from Stripe, recognized prices and the stored customer/company relationship. Provider event IDs are unique; retries are idempotent and older events cannot overwrite newer state.

The adapters follow the official [Stripe raw-body signature guidance](https://docs.stripe.com/webhooks/signature) and [subscription webhook lifecycle](https://docs.stripe.com/billing/subscriptions/webhooks). Customer-payment tables and receipts are not used for SaaS subscription charges. Provider-side cancellation, upgrade/downgrade timing and portal restrictions still require configuration and test-mode verification before activation.

## Development simulation

`scripts/simulate-subscription.mjs COMPANY_UUID PLAN [STATUS]` requires `NODE_ENV=development`, `ALLOW_BILLING_SIMULATION=true`, a local Supabase URL (`localhost`, `127.0.0.1` or `::1`) and a local service-role key. It refuses hosted Supabase destinations. There is no public simulation endpoint and no production button to grant paid plans. The transactional SQL suite can exercise subscription states without persisting fictitious successful payments.

## Validation status

- Final local verification on 2026-09-09: all 66 unit tests passed, including plan prices/limits, trial deadlines, status/grace/cancellation policy, historical reads, role + plan and invalid/stale/modified webhook signatures.
- TypeScript, ESLint and the Next.js production build passed. `git diff --check` found no whitespace errors. These local checks do not establish that the database migrations or authenticated production workflows are correct.
- Pricing inspected at 1440×1000 and 390×844; mobile document width stayed within the viewport.
- After explicit production authorization on 2026-09-09, the combined three-migration transactional suite passed, including an additional Owner-only downgrade review with ten occupied/reserved seats and no premature entitlement change. The script was checked for zero COMMIT statements and one final ROLLBACK. A subsequent read-only check confirmed the subscription schema had rolled back and zero temporary test companies/users remained.
- All three subscription migrations were then applied together in one transaction with a three-second lock timeout and a thirty-second statement timeout. Both existing companies received legacy access; authenticated subscription writes and anonymous subscription reads were checked as denied, and the billing service read privilege was checked before commit.
- Authenticated Billing browser validation and multi-session concurrency stress tests remain pending. The transactional tests validate subscription RLS, quota and seat boundaries, trial expiration, downgrade retention, Owner-only controls, role + plan, cross-company isolation, provider replay and stale events; they are not a concurrency stress test.
- Production rollout completed on 2026-09-09: GitHub implementation commit `3aa6d8b81f591565d066b0f0a15a699f81f812f0` has exactly the validated local source tree. Vercel deployment `dpl_EezUhjH7bFveZ5an88uj3X96vjWx` reached READY and was aliased to https://contractor-os-inky.vercel.app. The Vercel production build also passed. `/pricing` and `/login` returned HTTP 200; unauthenticated `/settings/billing` and `/dashboard` returned HTTP 307 to `/login`. The published Pricing page was verified in the browser. A post-migration query confirmed RLS enabled on all three subscription tables and both legacy companies preserved.
- Stripe Checkout/webhook delivery/portal tests were not run because Stripe is not configured. The local cryptographic signature unit tests are not a substitute for provider end-to-end tests.
- Before enabling Stripe, also validate overlapping Checkout requests (different plans or retry windows) to prevent duplicate paid subscriptions; the prepared adapter's request idempotency alone does not establish this guarantee.

## File inventory

New libraries: `plans.ts`, `subscriptions.ts`, `stripe-billing.ts`, `stripe-signature.ts`. New pages: public Pricing, upgrade state, Owner Billing; billing server actions and API adapters. New UI: pricing cards, billing controls, usage/plan banner, historical notice, upgrade card and basic dashboard. New tests: `tests/plans.test.ts`, `supabase/tests/subscription-rls.sql`; local simulation script and environment template.

Modified: app shell/dashboard layout, dashboard, Team page/controls, Settings, onboarding destination, centralized permissions, middleware, database types, role-suite fixture compatibility and README. No existing feature data was recreated or deleted.
