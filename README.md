# UnitKo

Unified context guide for developers and AI agents.

UnitKo is a real-estate rental management application focused on landlord and tenant workflows, multi-occupant or bed-space billing, and Supabase-backed data isolation using landlord-scoped records and RLS.

## 1) Product Summary

### What UnitKo does
- Manages rental properties for landlords.
- Supports occupied and vacant property lifecycle.
- Supports single-tenant and multi-occupant bed-space setups.
- Tracks billing schedules, payment status, paid amounts, per-tenant payment splits, and overflow credits.
- Provides tenant dashboard access via lightweight tenant sign-in flow.
- Supports archival or reset workflow for completed rentals.
- Supports reminder and webhook integrations through Zapier.

### Primary user roles
- Landlord: full CRUD on own properties and related data.
- Tenant: read tenant-specific dashboard data and payment info.

## 2) Tech Stack

- Framework: Next.js 16 (App Router)
- Language: TypeScript (strict mode)
- UI: React 19, Tailwind CSS 4, Radix UI, shadcn-style components
- Data and auth: Supabase (PostgreSQL + Auth + RLS)
- Forms and validation: react-hook-form + zod
- Notifications: sonner

## 3) Current App Routes

### Public
- /

### Auth
- /auth/landlord/login
- /auth/landlord/register
- /auth/tenant/login
- /auth/callback

### Protected landlord routes
- /dashboard/landlord
- /dashboard/landlord/profile
- /dashboard/landlord/archives
- /subscription

### Protected tenant route
- /dashboard/tenant

### API routes

Implemented:
- POST /api/tenant-auth/login — issues HMAC-signed `tenant_session` cookie.
- POST /api/tenant-auth/logout — clears the cookie.
- GET  /api/tenant-auth/session — verifies the cookie, returns `{ tenantId }`.
- GET  /api/tenant/dashboard — tenant-scoped reads.
- POST /api/reminders/tenant — landlord triggers an SMS reminder; server rebuilds the payload from Supabase and posts to `ZAPIER_TENANT_REMINDER_WEBHOOK`.
- GET  /api/webhooks/test — development-only smoke test for the planned Zapier webhooks (gated by `NODE_ENV === 'development'`).

Stubbed (empty directories under `src/app/api/`, **not** live endpoints — return 404 today):
- /api/webhooks/rent-due-today
- /api/webhooks/payment-submitted
- /api/webhooks/landlord-confirms
- /api/zapier/config

See [docs/ZAPIER_WEBHOOK_INTEGRATION.md](docs/ZAPIER_WEBHOOK_INTEGRATION.md) for the implementation plan and [docs/SMS_REMINDER_SETUP.md](docs/SMS_REMINDER_SETUP.md) for the Zapier + UniSMS setup runbook.

## 4) Core Features and Status

### Property and tenant management
- Property creation, edit, delete workflows are implemented.
- Multi-occupant support exists through max tenant and pax details fields.
- Property notes and amenities are supported.

### Billing and payments
- Billing entries support rent, other charges, gross due, paid amount, and status.
- Multi-tenant split tracking uses JSON fields for per-tenant payments and per-tenant amount breakdown.
- Overflow or excess payment support exists.

### Property reset and archives
- Archive and reset flow exists in UI and service layer.
- Archived records include tenant and billing snapshot data.

### Activity logs
- Activity log UI exists in property details.
- Table migration exists.
- Logging coverage is partial and inconsistent across write operations.

### Subscription
- Subscription plan fields and property limits are present.
- UI exists for subscription page.
- Some data is still mock-like or non-enforced in critical paths.

### Reminder and webhook integration
- Tenant reminder flow exists and uses server-side `ZAPIER_TENANT_REMINDER_WEBHOOK` via `/api/reminders/tenant`.
- Reminder throttling is enforced server-side: `/api/reminders/tenant` claims `billing_entries.last_reminded_at` with a conditional update, allowing one reminder per billing entry per UTC day. The earlier client-side `localStorage` check has been replaced.
- PH phone numbers are normalized to E.164 (`+639XXXXXXXXX`) on the server before the webhook is invoked; invalid numbers return `422`.
- An activity log entry (`tenant_reminder_sent`) is written after a successful webhook call, including the claim timestamp.
- A development-only webhook test API (`/api/webhooks/test`) exercises the three Zapier endpoints. It is gated to `NODE_ENV === 'development'`.

## 5) Data Model Snapshot

Main entities:
- profiles
- properties
- tenants
- billing_entries
- archived_tenants
- activity_logs

Important schema additions in migrations include:
- properties.landlord_id
- properties.max_tenants
- properties.bed_space_billing_mode
- properties.lease_date
- properties.notes
- tenants.email
- tenants.pax
- tenants.pax_details
- tenants.advance_payment
- tenants.security_deposit
- tenants.overflow
- billing_entries.paid_amount
- billing_entries.expense_items
- billing_entries.tenant_payments
- billing_entries.tenant_rent_amounts
- billing_entries.tenant_other_charges
- profiles subscription-related fields

## 6) Security and Access Control

### Implemented
- Landlord session uses Supabase Auth (cookies via `@supabase/ssr`).
- Tenant session uses an HMAC-signed, HTTP-only cookie (`tenant_session`, 24h TTL) issued by `/api/tenant-auth/login` and verified server-side via `/api/tenant-auth/session`. See `src/lib/tenant-session.ts`.
- Route guards use client-side HOCs (`withLandlordAuth`, `withTenantAuth`) in `src/components/auth/`.
- Server-side request handling is in `src/proxy.ts` (Next.js proxy/middleware export). It refreshes the Supabase session and redirects already-authenticated landlords away from auth pages. It does not enforce protection on `/dashboard/*`; that is intentionally delegated to the client HOCs to avoid redirect loops.
- RLS migrations enforce landlord data isolation at the database level.

### Important notes
- Tenant auth uses email + contact_number lookup (knowledge-based) — treat it as a lower assurance level than landlord auth.
- `TENANT_SESSION_SECRET` is **required** in production. In development, an ephemeral per-process secret is generated as a fallback (sessions reset on restart).

## 7) Environment Configuration

Create .env.local and provide:

- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- TENANT_SESSION_SECRET
- ZAPIER_TENANT_REMINDER_WEBHOOK
- ZAPIER_RENT_DUE_WEBHOOK
- ZAPIER_PAYMENT_SUBMITTED_WEBHOOK
- ZAPIER_LANDLORD_CONFIRMS_WEBHOOK

Notes:
- See .env.example for a ready-to-copy local template.
- `/api/reminders/tenant` uses `ZAPIER_TENANT_REMINDER_WEBHOOK` server-side.
- /api/webhooks/test reads the three ZAPIER_* webhook variables.

## 8) Local Development Setup

1. Install dependencies

	npm install

2. Configure .env.local with required variables.

3. Run database migrations in Supabase SQL editor from database/migrations.

4. Start development server

	npm run dev

5. Build for production validation

	npm run build

6. Lint

	npm run lint

## 9) Database Migration Guidance

Apply all SQL files in database/migrations in filename order on each environment.

Important:
- Keep `zz_canonicalize_atomic_rpc_functions.sql` as the last migration so final RPC definitions are deterministic.
- Do not reorder historical migrations that already ran in shared environments.

At minimum, verify these logical groups are applied:
- Profile and auth profile automation
- Landlord ownership and RLS
- Bed-space and pax details
- Billing enrichment and per-tenant amounts
- Activity logs
- Archive and reset related tables
- Subscription fields

After migration:
- Validate RLS policies are active.
- Validate existing records have landlord_id where required.

## 10) Strengths

- Strong feature depth for rental workflows.
- Modern stack and TypeScript strict mode.
- Landlord data isolation model via landlord_id + RLS is a strong foundation.
- Rich billing model for multi-occupant rentals.
- Extensive domain docs and migration history preserve business intent.

## 11) Audit Findings (Security, Reliability, Efficiency)

Findings below are based on direct code review as of April 2026.

### Security issues

#### High
- Development webhook test route has minimal request validation and no signature model.
	- Evidence: `src/app/api/webhooks/test/route.ts` validates only query `event` strings.
	- Risk: weak baseline pattern for future production webhook/API endpoints.
- Tenant login is still knowledge-based (email + contact number), not OTP/verified identity.
	- Evidence: tenant login requires matching profile data and sets a signed tenant cookie.
	- Risk: weaker assurance than passwordless OTP or full auth provider flow.

#### Medium
- Tenant login is knowledge-based and not rate-limited at the API.
	- Evidence: `src/app/api/tenant-auth/login/route.ts` accepts unlimited attempts; only credential match is required.
	- Risk: enumeration / brute-force of email+phone pairs.

### Reliability issues

#### High
- Migration history defines some RPC names multiple times.
	- Evidence: `create_property_atomic` and `archive_and_reset_property_atomic` appear in multiple migration files.
	- Risk: drift between environments when migration order is inconsistent; mitigated by canonicalization migration.

#### Medium
- Build validation can be flaky in VS Code PowerShell terminals due local shell trust prompts.
	- Evidence: shell integration publisher prompt can interrupt long-running `npm run build` checks.
	- Risk: false negatives in local validation unless terminal execution policy is settled.

### Efficiency issues

#### High
- Dashboard data fetching is broad and nested by default.
	- Evidence: `src/hooks/useProperties.ts` fetches properties with nested tenants and nested billing entries for all landlord properties in one query.
	- Risk: slow initial loads and heavy client-side processing at scale.

#### Medium
- Complex UI modules carry high maintenance and render-cost risk.
	- Evidence: billing and property form flows are concentrated in very large components, notably `src/components/edit-billing-popup.tsx` and `src/components/form-add-property.tsx`.
	- Risk: higher rerender overhead, harder debugging, and slower feature iteration.

## 12) Improvement Plan

### 0-30 days (highest impact)
1. Upgrade tenant login from knowledge-based checks to OTP-based verification.
2. Add server-side reminder throttling (per tenant or billing entry per day) instead of local-only throttling.
3. Add request validation and authentication controls to `/api/webhooks/test` or gate it to development only.
4. Add integration tests for critical RPC-backed flows: create property, archive/reset, reminder authorization.
5. Add CI gates for lint, typecheck, tests, and build.

### 31-60 days (stability and operability)
1. Add migration verification scripts or SQL health checks after deploy.
2. Introduce structured error taxonomy and consistent error handling across service layer.
3. Add audit logging coverage for remaining mutation paths (see `docs/ACTIVITY_LOG_ISSUES.md` for the current gap list).
4. Refine dashboard query strategy for large landlord portfolios.
5. Expand test coverage to include tenant dashboard and reminder workflows.

### 61-90 days (scalability and maintainability)
1. Refactor large components into smaller modules with clearer state boundaries.
2. Add pagination/query slicing in landlord dashboard data loading.
3. Move expensive derived calculations to memoized selectors or server-side computed queries.
4. Add CI gates for lint + typecheck + tests before deployment.
5. Consolidate docs into one maintained set and archive stale duplicates.

### Suggested security baseline controls
1. Enforce least-privilege RLS policies and validate with automated RLS tests.
2. Add audit logging for sensitive mutation paths (already partially implemented; continue coverage).
3. Add API abuse controls: request size limits, throttling, and standardized validation errors.

## 13) AI Agent Working Context

This section is intended for coding agents and new maintainers.

### Domain assumptions
- One landlord owns many properties.
- A property may have one or multiple occupants.
- Billing can be tracked at consolidated and per-tenant levels.
- Archive/reset is business-critical and should preserve financial history.

### High-impact files and modules
- src/components/property-details-popup.tsx
- src/components/edit-property-popup.tsx
- src/components/edit-billing-popup.tsx
- src/services/propertyService.ts
- src/services/archiveService.ts
- src/services/tenantService.ts
- src/services/tenantReminderService.ts
- src/hooks/useProperties.ts
- src/lib/supabase.ts
- src/lib/tenant-session.ts
- src/proxy.ts

### Agent editing guidelines for this project
- Preserve existing schema compatibility with current migrations.
- Do not assume docs are up-to-date; verify against source code.
- Prefer minimal, targeted changes in large components.
- Validate RLS and landlord ownership assumptions when changing queries.
- Keep billing math deterministic and cover edge cases (partial payments, overflows, per-tenant splits).

## 14) Documentation Health

Current documentation quality is mixed:
- Some docs are detailed and useful.
- Some docs appear stale versus current implementation.
- Some docs are currently empty in repository state.

Use this README as the primary source of current project context, then verify behavior directly in code for critical paths. See [docs/IMPLEMENTATION_GUIDE.md](docs/IMPLEMENTATION_GUIDE.md) for an index of feature docs grouped by topic with a stale/current marker.

### Known doc drift to be aware of
- Older docs (`PROPERTY_RESET_GUIDE.md`, `LANDLORD_PROPERTY_SEPARATION.md`, etc.) describe migrations as standalone files. Treat the canonical RPC and RLS state as whatever `database/migrations/zz_canonicalize_atomic_rpc_functions.sql` and the latest RLS migration declare.
- Anything claiming tenant auth uses `sessionStorage` is outdated: tenant auth now uses an HMAC-signed HTTP-only cookie. See `src/lib/tenant-session.ts` and `/api/tenant-auth/*`.
- Anything referring to `src/middleware.ts` is outdated: the file is now `src/proxy.ts`.

## 15) Suggested Next Documentation Tasks

1. Add a short architecture diagram (auth, data flow, webhook flow).
2. Add a migration verification guide with post-deploy SQL checks.
3. Document tenant auth assurance level and planned OTP rollout.
4. Add a test strategy section with critical-path coverage targets.

---

If you are onboarding, start with:
1. Sections 7, 8, and 9 for setup.
2. Sections 4 and 5 for feature and schema understanding.
3. Section 13 before making code changes.
