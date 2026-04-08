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
- /api/webhooks/test (development-only webhook test endpoint)

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
- Tenant reminder flow exists and uses NEXT_PUBLIC_ZAPIER_TENANT_REMINDER_URL.
- A development webhook test API exists for three Zapier endpoints.

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
- Landlord session uses Supabase Auth.
- Tenant session uses sessionStorage tenantId.
- Route guards use client-side HOCs.
- Server-side request handling exists in src/proxy.ts for session handling and selected redirects.
- RLS migrations exist to enforce landlord data isolation at database level.

### Important notes
- Some security docs refer to middleware.ts, but the current code uses src/proxy.ts.
- Tenant auth is intentionally lightweight and should be treated as lower assurance than landlord auth.

## 7) Environment Configuration

Create .env.local and provide:

- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- NEXT_PUBLIC_ZAPIER_TENANT_REMINDER_URL
- ZAPIER_RENT_DUE_WEBHOOK
- ZAPIER_PAYMENT_SUBMITTED_WEBHOOK
- ZAPIER_LANDLORD_CONFIRMS_WEBHOOK

Notes:
- .env.example is currently empty and should be populated.
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

Apply all SQL files in database/migrations in a consistent order on each environment.

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

#### Critical
- Tenant auth trust is client-side only in current flow.
	- Evidence: `src/lib/auth.ts` uses `sessionStorage` (`checkTenantAuth`, `getTenantId`), and `src/app/auth/tenant/login/page.tsx` stores the tenant identifier in `sessionStorage` after lookup.
	- Risk: session spoofing and unauthorized tenant dashboard access.

#### High
- Reminder webhook is called directly from client using a public env var.
	- Evidence: `src/services/tenantReminderService.ts` reads `NEXT_PUBLIC_ZAPIER_TENANT_REMINDER_URL` and calls it from browser code.
	- Risk: endpoint disclosure, bypass of centralized server-side controls, weak abuse protection.
- Development webhook test route has minimal request validation and no signature model.
	- Evidence: `src/app/api/webhooks/test/route.ts` validates only query `event` strings.
	- Risk: weak baseline pattern for future production webhook/API endpoints.

#### Medium
- Tenant reminder rate limit is local-browser-only.
	- Evidence: `src/services/tenantReminderService.ts` uses `localStorage` key checks.
	- Risk: easy bypass across devices/sessions; no server-enforced throttling.

### Reliability issues

#### Critical
- Multi-step create flow is not atomic.
	- Evidence: `src/services/propertyService.ts` inserts property, tenant, profile, and billing entries sequentially with manual cleanup.
	- Risk: partial writes and orphaned/inconsistent data on mid-flow failure.

#### High
- Archive/reset workflow is non-transactional across multiple destructive writes.
	- Evidence: `src/services/archiveService.ts` performs fetch, archive insert, billing delete, tenant delete, and property update as separate operations.
	- Risk: race conditions and partial reset states under concurrent actions or transient failures.
- No automated tests in project scripts.
	- Evidence: `package.json` includes `dev`, `build`, `start`, `lint` but no unit/integration/e2e test script.
	- Risk: regression risk for billing, auth, and migration-sensitive paths.

#### Medium
- Environment onboarding remains fragile.
	- Evidence: `.env.example` is empty.
	- Risk: misconfiguration and inconsistent local/staging/prod behavior.

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
1. Replace tenant `sessionStorage` auth with server-validated tenant sessions (Supabase auth, OTP, or signed token flow).
2. Move tenant reminder sending behind server API routes; keep webhook URLs server-only.
3. Add server-side request validation schemas (zod) for all API routes and future webhook handlers.
4. Convert property create flow into one atomic DB RPC transaction.
5. Add a minimal test baseline for critical paths: auth guard, create property flow, archive/reset flow, billing save flow.

### 31-60 days (stability and operability)
1. Convert archive/reset to a single transactional RPC with rollback-safe behavior.
2. Add server-enforced rate limiting for reminder sending (per tenant/billing/day).
3. Introduce structured error taxonomy and consistent error handling across service layer.
4. Populate `.env.example` with every required variable and usage notes.
5. Add migration verification checklist (post-migration health queries for required columns and RLS policies).

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
- src/lib/auth.ts
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

Use this README as the primary source of current project context, then verify behavior directly in code for critical paths.

## 15) Suggested Next Documentation Tasks

1. Populate .env.example with real variable names and comments.
2. Add an explicit migration order document.
3. Add a short architecture diagram (auth, data flow, webhook flow).
4. Add a test strategy section once automated tests are introduced.

---

If you are onboarding, start with:
1. Sections 7, 8, and 9 for setup.
2. Sections 4 and 5 for feature and schema understanding.
3. Section 13 before making code changes.
