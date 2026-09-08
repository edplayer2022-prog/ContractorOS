# Team roles and permissions

## Access policy

| Role | Operational access | Financial visibility | Team/settings |
| --- | --- | --- | --- |
| Owner | All existing modules | All | Full; last active Owner protected |
| Admin | All existing modules | All company and project reports | Team and company profile; cannot promote/change/deactivate Owners or edit financial defaults |
| Estimator | Customers, estimate create/edit/duplicate/send, read/use Rate Library | Cost inputs and estimate prices; no company-wide revenue/profit/payment reports | Personal profile only; no deleting customers/estimates/global rates |
| Project Manager | All current-company projects, related customers, approved estimates, Change Orders, project costs and project invoices | Project-level financial summary and costs; no company reports or direct payment records | Assign active members; personal profile only |
| Employee | Only explicitly assigned projects: customer name, site, schedule, status, employee notes | None; sensitive tables return zero rows and the project RPC returns an allowlisted projection | Personal profile only |

PM access is company-project-wide in this version, not assignment-limited. Employee access is assignment-limited. `projects.notes` stays private; `projects.employee_notes` is the separate crew-facing field. Estimate internal costs are necessary for an Estimator's work and do not grant company-level reporting access.

`lib/permission-policy.ts` defines named permissions. Server middleware checks PostgreSQL `has_company_permission`; `lib/permissions.ts` provides server helpers; `PermissionProvider`/`Can` filter controls. UI visibility is not the security boundary. PostgreSQL policies and checked security-definer workflow RPCs enforce authorization even on direct REST calls. Future configurable financial visibility should update both the database policy and matching typed UI policy, never just CSS.

## Membership, invitation and profile lifecycle

- `company_members` supports multiple companies per user. `users.company_id` is the selected context, not authority to access that company. `switch_company` checks active membership; direct changes to profile company ID are revoked. The switcher appears only with more than one active membership.
- Invitations have 256-bit random tokens, SHA-256 hashes at rest, seven-day expiry, verified-email matching, row locking, revocation and single-use acceptance. Membership and role come from the stored invitation, never submitted browser fields.
- `/team` offers invitation links, search, status filters, role changes, deactivation and reactivation. No paid email provider is integrated; copy and send the link yourself. Create Account preserves the invitation through email confirmation and automatically joins on return; existing accounts sign in and accept explicitly.
- Owner changes are serialized using a company lock. The last active Owner cannot be downgraded, deactivated or deleted. Admin cannot grant Owner or manage an existing Owner. Deactivation preserves business records and audit history while immediately invalidating company access on subsequent queries.
- `/profile` edits name, phone and avatar, never role. The `user-avatars` bucket accepts public PNG/JPEG/WebP images up to 2 MB with writes restricted to the user's folder. Profile images are public assets; do not upload confidential images.
- Last activity is throttled to fifteen-minute intervals. Company financial defaults remain Owner-only; Admin can edit the company profile.
- `/settings/audit-log` filters by user, event type, date range and module. Business writes and workflow events include company, actor, entity, timestamp and safe metadata; automatic events retain system attribution.

## Database changes

New tables: `company_members`, `team_invitations`, `project_members`, `audit_events`. Membership, company, user, status, role, invitation email/expiry, project assignment and event indexes support access checks and filters. Existing user, project, estimate-event and financial-event tables receive profile, crew-note and actor-attribution columns.

Apply these migrations once, in order, after the existing reporting migration:

1. `20260907000000_team_roles_permissions.sql`: memberships, roles, invites, RLS, profiles, assignment, workflow authorization, event attribution.
2. `20260907010000_team_security_hardening.sql`: remove creator-only bypasses; protect company context, parent/tenant relationships and settings; add safe switching, audit mirroring and editor item policies.
3. `20260907020000_team_workflow_completion.sql`: concurrent invitation safety, approved-estimate/project invoice scope for PM, audit backfill, safe INSERT RETURNING during company onboarding.
4. `20260908000000_team_event_and_assignment_guards.sql`: private event helper permits authorized workflow callers; assignment reads also require active current-company membership.

The private event helper and audit writer are not executable by authenticated/anonymous API clients. Parent foreign-key guards reject cross-company relationships, including a customer/job-site mismatch. Customer estimate/invoice projections and immutable approval snapshots are preserved. No service-role key is sent to the browser.

## Validation evidence — 2026-09-08

- SQL suite: all 15 requested scenarios passed against Supabase using authenticated-role/JWT contexts and transaction rollback. Includes replay/expired/revoked invitations, active-status changes, last Owner, actor attribution, forged role/company, foreign projects/invoices, Employee REST-equivalent table reads, private RPC denial and deactivated assignment reads.
- Authenticated REST smoke: all five role logins; Estimator customer/estimate creation, duplicate/send; anonymous approval of fictitious estimate; PM cost and test invoice; safe Employee assignment projection; deactivate/reactivate; last Owner guard; audit attribution passed. These were exclusively fictitious QA records, not actual customer approvals or payment transactions.
- Browser: Owner Team desktop/mobile, invitation/login/acceptance, Employee mobile assigned-project schedule and crew notes, forbidden reports/invoices, and PM desktop dashboard checked. Browser email delivery itself requires the configured Auth email service and was not asserted by the API suite.
- All 52 unit/static tests passed. TypeScript, ESLint (zero warnings) and the optimized production build passed. Tests cover calculations, existing public projections, reporting, permission matrix, redirect safety, token design, private helpers and assignment access. Run the commands in the README to repeat the local checks.

`scripts/team-smoke.mjs` is an opt-in integration test, not a production endpoint. It requires `CONTRACTOROS_QA_PASSWORD` and pre-provisioned `qa-team-<role>@contractoros.test` accounts in the hard-checked isolated `QA Browser Team` company. It intentionally creates fictitious business fixtures; never change it to target a real company. The transactional SQL suite is preferred for repeatable clean tests.

## Implementation inventory

New routes: `/team`, `/invite/[token]`, `/profile`, `/settings/audit-log`, `/my-projects`, role dashboards, `/access-denied`, `/membership-inactive`.

New components: `team-manager`, `invite-acceptance`, `company-switcher`, `permission-context`, `company-profile-form`, `profile-form`, `project-assignment`, `project-details-form`.

New libraries: `auth-redirect`, `permission-policy`, `permissions`. New tests: `permissions.test.ts`, `team-security.test.ts`, `auth-redirect.test.ts`, `supabase/tests/team-rls.sql`, plus the opt-in API smoke script.

Modified: authentication actions/forms/callbacks; company/customer/estimate/invoice/rate-library pages and controls; dashboard and project layouts; app shell; responsive CSS; Supabase middleware; data context and database types; README. No forbidden billing integrations, AI, payroll, tasks, GPS or chat were added.
