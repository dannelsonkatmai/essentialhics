# Essential HICS — Phase 1

**Hospital Incident Command System** — foundational platform for managing HICS operations, featuring full authentication, role-based access control (RBAC), organizational structure management, and HIPAA-compliant audit logging.

---

## Table of Contents

1. [Architecture](#architecture)
2. [Quick Start (Docker)](#quick-start-docker)
3. [Manual Local Setup](#manual-local-setup)
4. [Seeded Credentials](#seeded-credentials)
5. [Environment Variables](#environment-variables)
6. [SSO Configuration — Azure AD](#sso-configuration--azure-ad)
7. [SSO Configuration — Okta](#sso-configuration--okta)
8. [API Reference](#api-reference)
9. [Running Tests](#running-tests)
10. [Project Structure](#project-structure)
11. [Security Notes](#security-notes)
12. [Phase 2 Roadmap](#phase-2-roadmap)

---

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────┐
│  React Frontend │───▶│  Express Backend  │───▶│  PostgreSQL │
│  (Vite + TS)    │    │  (Node + TS)      │    │  (Primary)  │
└─────────────────┘    └──────────────────┘    └─────────────┘
                                │
                                ▼
                        ┌─────────────┐
                        │    Redis     │
                        │ (Sessions + │
                        │  Pub/Sub)   │
                        └─────────────┘
```

| Layer      | Stack |
|------------|-------|
| Frontend   | React 18, TypeScript, Vite, Tailwind CSS, React Query, Zustand, React Hook Form + Zod |
| Backend    | Node.js, Express, TypeScript, Prisma ORM |
| Database   | PostgreSQL 16 |
| Cache      | Redis 7 |
| Auth       | JWT (access + refresh), TOTP MFA (otplib), SAML 2.0 / OAuth 2.0 (passport.js) |

---

## Quick Start (Docker)

### Prerequisites

- Docker Desktop 4.x+
- `git`

### Steps

```bash
# 1. Clone the repo
git clone <repo-url> essential-hics
cd essential-hics

# 2. Copy and configure environment
cp .env.example .env

# 3. Generate required secrets
node -e "
  const crypto = require('crypto');
  console.log('JWT_ACCESS_SECRET=' + crypto.randomBytes(64).toString('hex'));
  console.log('JWT_REFRESH_SECRET=' + crypto.randomBytes(64).toString('hex'));
  console.log('ENCRYPTION_KEY=' + crypto.randomBytes(32).toString('hex'));
"
# Paste those values into .env

# 4. Start everything
docker compose up -d

# 5. Run database migrations and seed
docker compose exec backend npx prisma migrate dev
docker compose exec backend npm run db:seed

# 6. Open the app
open http://localhost:5173
```

Seeded credentials are printed to the console by the seed script.

---

## Manual Local Setup

### Prerequisites

- Node.js 20+
- PostgreSQL 16
- Redis 7

### Database

```bash
createdb hics
psql hics < database/init.sql
```

### Backend

```bash
cd backend
npm install
cp ../.env.example .env   # fill in values
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```

### Database seed

```bash
cd database
npm install
npm run seed
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The app will be at **http://localhost:5173** and the API at **http://localhost:3001**.

---

## Seeded Credentials

The seed script creates four users and prints their passwords to the console (they are random each run). Use these to sign in immediately after seeding.

| Role | Email | Password |
|------|-------|----------|
| SYSTEM_ADMIN | `sysadmin@apexhealth.example` | *printed to console* |
| FACILITY_ADMIN (AGH) | `fadmin.agh@apexhealth.example` | *printed to console* |
| FACILITY_ADMIN (ANC) | `fadmin.anc@apexhealth.example` | *printed to console* |
| INCIDENT_COMMANDER | `dr.chen@apexhealth.example` | *printed to console* |

> **Note:** All seeded users have `mustChangePassword: false` so you can explore the app immediately. In production, set this to `true`.

---

## Environment Variables

See [`.env.example`](.env.example) for all variables with descriptions. Required values:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection URL with password |
| `JWT_ACCESS_SECRET` | 64-char hex secret for access tokens |
| `JWT_REFRESH_SECRET` | 64-char hex secret for refresh tokens (must differ from above) |
| `ENCRYPTION_KEY` | 32-byte hex key for AES-256 encryption of MFA secrets |
| `FRONTEND_URL` | CORS origin — must match your frontend URL exactly |

---

## SSO Configuration — Azure AD

### 1. Register an application in Azure

1. Open **Azure Active Directory → App registrations → New registration**
2. Set **Redirect URI**: `https://your-domain/auth/sso/azure/callback`
3. Under **Certificates & secrets**, create a client secret and copy it
4. Under **API permissions**, add: `openid`, `profile`, `email`, `User.Read`
5. Note your **Tenant ID**, **Client ID**, and **Client Secret**

### 2. Configure group-to-role mapping

In `health_systems.settings` (or via the Settings UI):

```json
{
  "ssoConfig": {
    "azure": {
      "tenantId": "<your-tenant-id>",
      "clientId": "<your-client-id>",
      "clientSecret": "<encrypted-at-rest>",
      "roleMapping": {
        "<azure-group-object-id>": "INCIDENT_COMMANDER",
        "<another-group-id>": "FACILITY_ADMIN"
      }
    }
  }
}
```

### 3. Set environment variables

```env
AZURE_AD_TENANT_ID=your-tenant-id
AZURE_AD_CLIENT_ID=your-client-id
AZURE_AD_CLIENT_SECRET=your-client-secret
AZURE_AD_REDIRECT_URI=https://your-domain/auth/sso/azure/callback
```

### 4. First SSO login (JIT provisioning)

On first login, a user record is automatically created with:
- `authProvider: AZURE_AD`
- `externalId`: set to the Azure AD subject (`oid` claim)
- HICS role assigned based on the group mapping table
- `mustChangePassword: false` (SSO users never set a local password)

---

## SSO Configuration — Okta

### 1. Create an OIDC app in Okta

1. Open **Okta Admin → Applications → Create App Integration**
2. Choose **OIDC — OpenID Connect** → **Web Application**
3. Set **Sign-in redirect URI**: `https://your-domain/auth/sso/okta/callback`
4. Assign groups to the app

### 2. Configure group claims

In your Okta app, add a custom claim named `groups` with **Groups filter** matching your HICS groups.

### 3. Set environment variables

```env
OKTA_DOMAIN=your-org.okta.com
OKTA_CLIENT_ID=your-okta-client-id
OKTA_CLIENT_SECRET=your-okta-client-secret
OKTA_REDIRECT_URI=https://your-domain/auth/sso/okta/callback
```

### 4. Role mapping

Same format as Azure AD — map Okta group names to HICS roles in `ssoConfig.okta.roleMapping`.

---

## API Reference

The full OpenAPI 3.1 spec is at [`docs/openapi.yaml`](docs/openapi.yaml).

You can explore it locally with Swagger UI:

```bash
npx @stoplight/prism-cli mock docs/openapi.yaml
# or
npx swagger-ui-express docs/openapi.yaml
```

### Key endpoints summary

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/login` | Email + password login |
| POST | `/auth/mfa/verify` | Complete MFA challenge |
| POST | `/auth/refresh` | Rotate refresh token |
| POST | `/auth/logout` | Revoke session |
| POST | `/auth/forgot-password` | Request reset email |
| POST | `/auth/reset-password` | Reset with token |
| GET | `/api/users` | List users |
| POST | `/api/facilities/:id/users` | Create user at facility |
| POST | `/api/facilities/:id/users/import` | Bulk CSV import |
| GET | `/api/facilities/:id/positions` | HICS org chart |
| GET | `/api/audit-logs` | Paginated audit log |
| GET | `/api/audit-logs/export` | CSV export |
| GET/PUT | `/api/health-system/settings` | System settings |

---

## Running Tests

### Backend unit tests

```bash
cd backend
npm test
```

### With coverage

```bash
npm run test:coverage
# Minimum 80% line coverage enforced on auth and RBAC modules
```

### Integration tests (require test database)

```bash
DATABASE_URL=postgresql://user:pass@localhost/hics_test npm test
```

### Dependency audit

```bash
cd backend && npm audit --audit-level=high
cd frontend && npm audit --audit-level=high
```

---

## Project Structure

```
essential-hics/
├── backend/
│   ├── src/
│   │   ├── app.ts              # Express app setup (CORS, Helmet, routes)
│   │   ├── server.ts           # Entry point
│   │   ├── config/             # DB, Redis, logger, env validation
│   │   ├── middleware/
│   │   │   ├── auth.middleware.ts      # JWT validation
│   │   │   ├── rbac.middleware.ts      # requirePermission() factory
│   │   │   ├── validate.middleware.ts  # Zod request validation
│   │   │   └── errorHandler.middleware.ts
│   │   ├── routes/
│   │   │   ├── auth.routes.ts
│   │   │   ├── users.routes.ts
│   │   │   ├── facilities.routes.ts
│   │   │   ├── auditLog.routes.ts
│   │   │   └── healthSystem.routes.ts
│   │   ├── services/
│   │   │   ├── auth.service.ts    # Login, session, password reset
│   │   │   ├── mfa.service.ts     # TOTP enroll/verify, backup codes
│   │   │   └── email.service.ts
│   │   ├── utils/
│   │   │   ├── permissions.ts     # ROLE_PERMISSIONS matrix + canDo()
│   │   │   ├── password.ts        # bcrypt, policy validation
│   │   │   ├── tokens.ts          # JWT helpers, secure token generation
│   │   │   ├── encryption.ts      # AES-256-GCM
│   │   │   └── audit.ts           # writeAuditLog(), diffObjects()
│   │   └── tests/
│   │       ├── unit/
│   │       └── integration/
│   ├── Dockerfile
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx              # Router + auth bootstrap
│   │   ├── api/                 # Axios client, API modules
│   │   ├── stores/              # Zustand auth store
│   │   ├── hooks/               # usePermission, useAuth
│   │   ├── types/               # Shared TypeScript types
│   │   ├── components/layout/   # DashboardShell, Sidebar, TopNav
│   │   └── pages/
│   │       ├── Login.tsx
│   │       ├── MfaVerify.tsx
│   │       ├── MfaEnroll.tsx
│   │       ├── ForgotPassword.tsx
│   │       ├── ResetPassword.tsx
│   │       ├── admin/           # Users, UserDetail, Facilities, AuditLog
│   │       └── profile/         # Profile & security
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
│
├── database/
│   ├── schema.prisma            # Full Prisma schema (all 8 models)
│   ├── seed.ts                  # Seeds 1 health system, 2 facilities, 4 users
│   └── init.sql                 # audit_logs immutability trigger
│
├── docs/
│   └── openapi.yaml             # OpenAPI 3.1 spec (all Phase 1 endpoints)
│
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## Security Notes

| Control | Implementation |
|---------|---------------|
| Password hashing | bcrypt, 12 salt rounds |
| Token storage | Access token in memory only; refresh in HttpOnly/Secure/SameSite=Strict cookie |
| Token rotation | Refresh token rotated on every use |
| MFA secrets | AES-256-GCM encrypted at rest |
| SSO client secrets | AES-256-GCM encrypted in DB |
| Audit log | Append-only enforced by PostgreSQL trigger |
| CORS | Exact origin allowlist — no wildcards |
| Security headers | Helmet.js: CSP, HSTS, X-Frame-Options, X-Content-Type-Options |
| Rate limiting | Login: 10/15min · Refresh: 30/15min · Reset: 5/hr (per IP) |
| Account lockout | 5 failed attempts → 15-minute lockout (logged to audit) |
| SQL injection | Prisma parameterized queries only — no raw string interpolation |
| Error messages | Generic to client; full details server-side only |

---

## Phase 2 Features

Phase 2 is fully implemented and builds on the Phase 1 foundation.

| Feature | Details |
|---------|---------|
| **Incident Management** | Declare / close incidents, auto-numbered IDs (`APGE-2026-0001`), operational periods |
| **IAP Forms** | 10 ICS/HICS forms (ICS-201 → HICS-252), TipTap rich-text, auto-save, per-form completeness |
| **Approval Workflow** | DRAFT → IN_REVIEW → APPROVED → PUBLISHED → ARCHIVED; 60% gate; ICS-202 must reach 100%; e-signature on HICS-252 |
| **Template Library** | Parent/child template inheritance, objectives bank, tactics bank |
| **HICS Command Structure** | Live org board, drag-and-drop assignment, real-time Socket.io updates |
| **PDF Export** | Async Puppeteer/pdf-lib pipeline via Bull queue + MinIO; 72-hour signed download URLs |
| **In-app Notifications** | Slide-over panel, unread badge, real-time WebSocket delivery |

---

## Phase 2 Setup

### Additional services

Phase 2 adds **MinIO** (S3-compatible object storage for PDF exports):

```bash
docker compose up -d          # starts postgres, redis, minio, backend, frontend
# MinIO console → http://localhost:9001  (login: hics_minio / hics_minio_secret)
```

### PDF export worker

The worker runs as a separate process (Bull + Puppeteer):

```bash
# Local:
cd backend && npm run worker

# Docker:
docker compose exec backend npm run worker
```

### Phase 2 environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MINIO_ENDPOINT` | `localhost` | MinIO hostname |
| `MINIO_PORT` | `9000` | MinIO API port |
| `MINIO_USE_SSL` | `false` | Enable HTTPS for MinIO |
| `MINIO_ACCESS_KEY` | `hics_minio` | MinIO access key |
| `MINIO_SECRET_KEY` | — | MinIO secret key |
| `MINIO_BUCKET` | `hics-exports` | Bucket for PDF exports |
| `MINIO_SIGNED_URL_EXPIRY` | `259200` | Signed URL TTL (72 h) |
| `VITE_WS_URL` | `ws://localhost:3001` | WebSocket URL for frontend |

### Key Phase 2 API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/api/facilities/:fid/incidents` | List / declare incidents |
| POST | `/api/facilities/:fid/incidents/:id/close` | Close incident |
| GET/POST | `/api/facilities/:fid/incidents/:id/periods` | Operational periods |
| GET | `/api/iap/:iapId` | Full IAP with all form data |
| PATCH | `/api/iap/:iapId/forms/:formNumber` | Auto-save form (debounced) |
| POST | `/api/iap/:iapId/submit` | Submit for review (60% gate) |
| POST | `/api/iap/:iapId/approve` | Approve IAP |
| POST | `/api/iap/:iapId/return` | Return to draft with notes |
| POST | `/api/iap/:iapId/publish` | Sign + publish (e-signature) |
| POST | `/api/iap/:iapId/export` | Queue async PDF export |
| GET | `/api/iap/:iapId/export/:jobId` | Poll PDF export job status |
| GET/POST | `/api/facilities/:fid/incidents/:id/positions` | Org board CRUD |
| POST | `/api/facilities/:fid/incidents/:id/positions/sync-203` | Push assignments → ICS-203 |
| GET/POST | `/api/templates` | IAP templates |
| GET | `/api/templates/:id/resolve` | Merged parent + child defaults |
| GET/POST | `/api/templates/objectives` | Objectives bank |
| GET/POST | `/api/templates/tactics` | Tactics bank |
| GET | `/api/notifications` | In-app notifications |
| POST | `/api/notifications/:id/read` | Mark notification read |

### Phase 2 seed data

After `npm run db:seed`, the following Phase 2 data is available:

- **Sample Incident:** `APGE-2026-0001` — Mass Casualty MCI Drill (ACTIVE, isExercise=true)
- **Operational Period 1** with a DRAFT IAP ready to edit
- **3 IAP Templates:** Mass Casualty (MCI), Internal Fire/Evacuation, Utility Failure
- **10 Objectives** in objectives bank (CRITICAL → LOW)
- **5 Tactics** in tactics bank
- **Dr. Sarah Chen** assigned as Incident Commander on the sample incident

---

## Phase 3 — Resource Logistics, Cost Tracking & FEMA PA Export

### Additional dependencies (auto-installed)

| Package | Purpose |
|---------|---------|
| `decimal.js` | Precise monetary arithmetic (backend + frontend) |
| `exceljs` | 9-sheet FEMA PA workbook builder |
| `node-cron` | 4 scheduled background jobs |
| `recharts` | Cost dashboard charts |
| `@tanstack/react-table` | Resource board list/table view |
| `react-csv` | Cost ledger CSV export |

### Running Phase 3 workers

```bash
# FEMA PA XLSX export worker (Bull queue)
npm run worker:fema --workspace=backend

# Operational-period PDF worker (Bull queue)
npm run worker:cost-pdf --workspace=backend

# Cron scheduler (all 4 jobs)
npm run cron --workspace=backend
```

### Cron schedule

| Job | Cron | Description |
|-----|------|-------------|
| Cost rollup | `*/15 * * * *` | Pre-compute `CostRollup` snapshots for all ACTIVE incidents |
| ETA alerts | `*/5 * * * *` | Notify logistics of IN_TRANSIT resources within 2-hour ETA window |
| Request escalation | `*/30 * * * *` | Escalate overdue APPROVED requests (IMMEDIATE >1h, PRIORITY >4h, ROUTINE >24h) |
| Daily cost digest | `0 6 * * *` | Email FINANCE_ADMIN_SECTION_CHIEF + COST_UNIT_LEADER with prior-day totals |

### Decimal.js policy

**All monetary arithmetic must use `decimal.js`.** Never use native JS `number` for currency.

```typescript
import Decimal from 'decimal.js';
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

const total = new Decimal(unitCost).times(quantity);
// Store as string: total.toFixed(4)
// Display: parseFloat(total.toFixed(2)).toLocaleString('en-US', { minimumFractionDigits: 2 })
```

Database columns for monetary values are `NUMERIC(14,4)` (Prisma `@db.Decimal(14,4)`).

### FEMA PA CAT_Z 5% management cost cap

The `CAT_Z` category (management costs) is capped at 5% of total direct costs per FEMA PA policy. This cap is **enforced at the reporting/display layer only** — cost records are never modified. The XLSX builder and the `CostRollup` computation both display an advisory when actual CAT_Z exceeds the cap.

### Resource lifecycle state machine

```
ORDERED → IN_TRANSIT → AVAILABLE ↔ ASSIGNED
                               ↓
                        OUT_OF_SERVICE
                               ↓
                        DEMOBILIZED (terminal)
```

Any status can transition to `OUT_OF_SERVICE`. `DEMOBILIZED` has no valid targets. All transitions are recorded in append-only `ResourceStatusHistory` (PostgreSQL trigger prevents UPDATE/DELETE).

### ICS-213RR request workflow

```
DRAFT → SUBMITTED → APPROVED → PARTIALLY_FILLED → FILLED (terminal)
                 ↘ DENIED (terminal)
DRAFT/SUBMITTED/APPROVED → CANCELLED (terminal)
```

Request numbers are auto-generated: `213RR-{incidentNumber}-{####}` (4-digit zero-padded, per-incident sequence).

### FEMA PA Export (9-sheet XLSX)

Trigger export from the Cost Ledger page → **Export FEMA PA**. The export is queued via Bull and processed by the `fema-export` worker. Progress events are pushed over Socket.io (`export:progress`). A download link appears when the job reaches `COMPLETED`.

Sheets generated:
1. **Summary** — incident metadata + category totals + CAT_Z advisory
2. **Labor** — all `LABOR` cost records with hours/rates breakdown
3. **Equipment** — `EQUIPMENT` records with hours + mileage
4. **Supplies** — `SUPPLY` records
5. **Contracts** — `CONTRACT` records
6. **Overhead** — `CAT_Z` records + cap advisory
7. **Resources** — all incident resources with lifecycle timestamps
8. **Mutual Aid** — active mutual aid agreements
9. **Timeline** — status history for all resources

### Phase 3 API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/api/facilities/:fid/resource-catalog` | List / create resource types |
| PATCH/DELETE | `/api/facilities/:fid/resource-catalog/:typeId` | Update / delete resource type |
| PUT | `/api/facilities/:fid/resource-catalog/:typeId/inventory` | Upsert facility inventory |
| GET/POST | `/api/facilities/:fid/incidents/:id/resources` | List / add incident resources |
| GET | `/api/facilities/:fid/incidents/:id/resources/summary` | Status counts by type |
| PATCH | `/api/facilities/:fid/incidents/:id/resources/:rId` | Update resource |
| POST | `/api/facilities/:fid/incidents/:id/resources/:rId/transition` | State machine transition |
| POST | `/api/facilities/:fid/incidents/:id/resources/:rId/demobilize` | Demobilize (terminal) |
| POST | `/api/facilities/:fid/incidents/:id/resources/bulk-checkin` | Bulk ORDERED→AVAILABLE |
| GET | `/api/facilities/:fid/incidents/:id/resources/:rId/history` | Status history |
| GET/POST | `/api/facilities/:fid/incidents/:id/requests` | List / create 213RR requests |
| GET | `/api/facilities/:fid/incidents/:id/requests/:rId` | Get request detail |
| POST | `/api/facilities/:fid/incidents/:id/requests/:rId/submit` | Submit draft |
| POST | `/api/facilities/:fid/incidents/:id/requests/:rId/approve` | Approve |
| POST | `/api/facilities/:fid/incidents/:id/requests/:rId/deny` | Deny |
| POST | `/api/facilities/:fid/incidents/:id/requests/:rId/cancel` | Cancel |
| POST | `/api/facilities/:fid/incidents/:id/requests/:rId/line-items/:liId/fulfill` | Record fulfillment |
| GET/POST | `/api/facilities/:fid/incidents/:id/costs` | List / create cost records |
| GET | `/api/facilities/:fid/incidents/:id/costs/rollup` | Pre-computed cost rollup |
| POST | `/api/facilities/:fid/incidents/:id/costs/rollup/compute` | Force rollup recompute |
| GET | `/api/facilities/:fid/incidents/:id/costs/:cId` | Cost record detail |
| POST | `/api/facilities/:fid/incidents/:id/costs/:cId/approve` | Approve cost record |
| DELETE | `/api/facilities/:fid/incidents/:id/costs/:cId` | Soft-delete cost record |
| POST | `/api/facilities/:fid/incidents/:id/costs/export/fema-pa` | Queue FEMA PA XLSX export |
| POST | `/api/facilities/:fid/incidents/:id/costs/export/period-pdf` | Queue period cost PDF |
| GET | `/api/facilities/:fid/incidents/:id/costs/export/:jobId` | Poll export job status |
| GET/POST | `/api/facilities/:fid/mutual-aid` | List / create mutual aid agreements |
| PATCH | `/api/facilities/:fid/mutual-aid/:agreementId` | Update agreement |

### Phase 3 seed data

After `npm run db:seed`:

- **10 Resource Types** — nurses, physician, generators, ambulances, N95 masks, IV fluid, stretchers, command vehicle, DMAT team, water purification
- **Facility Inventory** — 3 supply types with on-hand quantities and reorder points
- **5 Incident Resources** — AVAILABLE (nurses + command post), IN_TRANSIT (generator), ASSIGNED (N95 masks), ORDERED (ALS ambulance)
- **Resource Status History** — 7 history entries showing state transitions
- **2 Resource Requests** — `213RR-APGE-2026-0001-0001` (APPROVED, 3 line items, partially filled) + `213RR-APGE-2026-0001-0002` (SUBMITTED, 1 IMMEDIATE priority line item)
- **9 Cost Records** — 3 labor, 2 equipment, 2 supply, 1 contract, 1 overhead (CAT_Z); labor/equipment sub-records populated
- **1 Mutual Aid Agreement** — Riverside County EMS (EMAC-2024-0017, active through 2026)
- **2 Cost Rollups** — period-level + incident-level pre-computed snapshots
