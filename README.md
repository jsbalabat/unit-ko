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

## 11) Weaknesses and Risks

### Critical
- Tenant authentication is lightweight (identifier + sessionStorage) and not equivalent to password-based auth.
- Some business-critical calculations happen in client-heavy flows, increasing risk of drift and complexity.
- No automated test suite is present.

### High
- Documentation drift: several docs are stale or empty while feature behavior evolved.
- Transaction-like multi-step operations (archive or reset, property creation cleanup) are not wrapped in DB transactions.
- Activity logging is not consistently applied to all mutation paths.

### Medium
- Subscription enforcement is not consistently centralized.
- Environment documentation is incomplete (.env.example empty).
- Very large UI components (notably property details and billing-related popups) increase maintenance cost.

## 12) Recommendations

### Priority 1 (stability and security)
1. Harden tenant auth flow (tokenized flow or OTP/passwordless with server verification).
2. Move critical billing mutation logic into secure server-side endpoints or RPC functions.
3. Add integration tests for auth, billing mutation, archive/reset, and RLS behavior.

### Priority 2 (correctness and operability)
1. Convert archive/reset and other multi-step write flows into transactional RPC procedures.
2. Centralize activity logging in service utilities and call from all mutation points.
3. Create an authoritative .env.example with all required variables and descriptions.

### Priority 3 (maintainability)
1. Break large UI modules into smaller composable units.
2. Add pagination or query slicing for heavy property and billing views.
3. Consolidate and retire stale docs in docs/ after this README becomes source-of-truth.

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
