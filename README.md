# StackFox

AI-powered IT consultancy platform — service catalog, estimation, engagement, project delivery, and team operations in one system.

## Architecture

```
stackfox/
├── apps/
│   ├── api/            # Fastify 4 REST API (port 4000)
│   └── web/            # Next.js 14 marketing site (port 3000)
├── client/             # Vite + React dashboard (port 5173)
├── packages/
│   ├── prisma/         # Shared Prisma schema & client
│   └── core/           # Shared types, validators, state machines
├── shared/
│   └── stackfox-data.json   # Service catalog data
├── turbo.json
└── pnpm-workspace.yaml
```

- **Turborepo** orchestrates `apps/*` and `packages/*`.
- **client/** is a standalone Vite app; it proxies `/api/*` to the API server during development.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **API** | Fastify 4, TypeScript, Prisma 5, BullMQ, Redis |
| **Marketing** | Next.js 14, React 18, Tailwind CSS |
| **Dashboard** | Vite 5, React 18, Tailwind CSS, React Router, Zustand |
| **Database** | PostgreSQL (Supabase) |
| **Auth** | JWT (jsonwebtoken) |
| **AI** | Google Gemini |
| **Payments** | Razorpay, Stripe |
| **Storage** | Cloudflare R2 / S3 |
| **Queue** | BullMQ + Redis / Upstash |

## Features

### Public Pages
- Service catalog with cost breakdowns and timelines
- Express checkout (3-field quick order)
- Interactive quiz → recommended tier
- Public roadmap and changelog
- Guides (DPDP, GST, SEO)
- Industry bundle detail pages
- Help center and demo request form

### Acquisition Tools
- Website Audit — SEO/lighthouse-style checks
- Estimator — rule-based project estimation
- Brief Builder — AI-generated project briefs (voice, sketch, URL, text)
- Legal Starter Pack — DPDP-compliant document generation
- GST Invoice — line-item invoice builder with live totals

### Client Dashboard (`/app/client`)
- Project overview, milestones, and timeline
- Quotes, invoices, and payment tracking
- File management and messaging
- Support tickets and change requests
- Engagement and contract management
- Timesheet approval
- Activity feed, reports, and post-delivery handover
- Referral program

### Team Dashboard (`/app/team`)
- Personal task board (Kanban + list views)
- Project assignments and details
- Timesheet management
- Calendar with task scheduling
- Performance reviews (submit + view)
- Knowledge base with article suggestions
- PM suite: Queue, Sprints, Resources, Quality, Finance, Clients, Analytics, SE Queue

### Admin Dashboard (`/app/admin`)
- Service catalog CRUD (services, features, dependencies, bundles, rate cards)
- User management and role control
- Order and project oversight
- RFP management
- Referral program oversight
- Business reports with CSV export
- System settings
- Project wall / lead inquiries
- Compliance calendar
- Screening queue
- Notification templates
- Feature flags
- Blog/content management

## Getting Started

### Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | >= 20 | Required by `engines` in root `package.json` |
| pnpm | 9.6.0 | `corepack enable && corepack prepare pnpm@9.6.0 --activate` |
| PostgreSQL | 15+ | Via Supabase (hosted) or local instance |
| Redis | 6+ | Via Upstash (hosted) or local instance |

### Installation

```bash
# Clone the repository
git clone <repo-url> stackfox
cd stackfox

# Install monorepo dependencies
pnpm install

# Install client dependencies
cd client && pnpm install && cd ..

# Generate Prisma client
pnpm --filter packages/prisma db:generate

# Push schema to database
pnpm --filter packages/prisma db:push

# (Optional) Seed initial data
pnpm --filter packages/prisma db:seed
```

The seed creates an `ADMIN` account (`admin@stackfox.tech`) so the admin panel at
`/app/admin` can be signed into. Its password is `ADMIN_PASSWORD` from `.env`
(default `Admin@Stackfox2025` — change it before any non-local deployment).

### Environment Variables

Create a `.env` file in the project root:

```env
# ── Database (Supabase PostgreSQL) ─────────────────────
DATABASE_URL=postgresql://postgres.<project-ref>:<password>@aws-0-ap-south-1.pooler.supabase.com:6543/postgres
DIRECT_DATABASE_URL=postgresql://postgres.<project-ref>:<password>@aws-0-ap-south-1.pooler.supabase.com:5432/postgres

# ── Supabase ───────────────────────────────────────────
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_PUBLISHABLE_KEY=eyJ...
SUPABASE_SECRET_KEY=eyJ...

# ── Redis ──────────────────────────────────────────────
UPSTASH_REDIS_REST_URL=https://<your-upstash>.upstash.io
UPSTASH_REDIS_REST_TOKEN=<token>
REDIS_URL=redis://default:<password>@<host>:6379

# ── Auth ──────────────────────────────────────────────
JWT_SECRET=<random-string-32-chars>
AUTH_SECRET=<random-string-32-chars>

# ── AI ────────────────────────────────────────────────
GEMINI_API_KEY=<google-ai-key>

# ── Payments (optional) ──────────────────────────────
RAZORPAY_KEY_ID=rzp_...
RAZORPAY_KEY_SECRET=<secret>
STRIPE_SECRET_KEY=sk_...

# ── Storage (Cloudflare R2) ──────────────────────────
R2_ACCOUNT_ID=<account-id>
R2_ACCESS_KEY_ID=<access-key>
R2_SECRET_ACCESS_KEY=<secret>
R2_BUCKET_NAME=stackfox-uploads

# ── Server ────────────────────────────────────────────
PORT=4000
CORS_ORIGIN=http://localhost:5173,http://localhost:3000
NODE_ENV=development
LOG_LEVEL=debug
```

> **Important**: `DATABASE_URL` uses port **6543** (Supabase connection pooler). `DIRECT_DATABASE_URL` uses port **5432** (direct connection, for migrations).

### Development

```bash
# Start API + Web (Turborepo)
pnpm dev

# In a separate terminal — start client dashboard
cd client
pnpm dev
```

This starts:
- **API** at `http://localhost:4000` (Fastify)
- **Web** at `http://localhost:3000` (Next.js)
- **Client** at `http://localhost:5173` (Vite)

### Verify Setup

```bash
# API health check
curl http://localhost:4000/health

# Prisma Studio (visual database browser)
pnpm --filter packages/prisma db:studio
```

## Available Scripts

### Root (Turborepo)

| Script | Command | Description |
|--------|---------|-------------|
| `pnpm dev` | `turbo dev` | Start all dev servers |
| `pnpm build` | `turbo build` | Build all apps |
| `pnpm lint` | `turbo lint` | Lint all packages |
| `pnpm typecheck` | `turbo typecheck` | TypeScript check all packages |
| `pnpm db:generate` | `turbo db:generate` | Generate Prisma client |
| `pnpm db:push` | `turbo db:push` | Push schema to database |
| `pnpm db:migrate` | `turbo db:migrate` | Run Prisma migrations |
| `pnpm db:seed` | `turbo db:seed` | Seed the database |
| `pnpm clean` | `turbo clean` | Remove build artifacts |

### API (`apps/api`)

| Script | Command | Description |
|--------|---------|-------------|
| `pnpm dev` | `tsx watch src/server.ts` | Dev server with hot reload |
| `pnpm build` | `tsc` | Compile to `dist/` |
| `pnpm start` | `node dist/server.js` | Production server |
| `pnpm worker` | `tsx src/workers/index.ts` | Run background workers |
| `pnpm lint` | `eslint src/` | Lint API code |
| `pnpm typecheck` | `tsc --noEmit` | TypeScript check |

### Client (`client/`)

| Script | Command | Description |
|--------|---------|-------------|
| `pnpm dev` | `vite` | Dev server on port 5173 |
| `pnpm build` | `vite build` | Production build to `dist/` |
| `pnpm preview` | `vite preview` | Preview production build |
| `pnpm lint` | `eslint src/ --ext .js,.jsx --fix` | Lint and fix |

## API Overview

The API is mounted at `http://localhost:4000` (no `/api` prefix).

### Core Endpoints

| Category | Endpoints |
|----------|-----------|
| **Auth** | `POST /auth/register`, `/auth/login`, `/auth/logout`, `/auth/me`, `/auth/forgot-password`, `/auth/reset-password` |
| **Catalog** | `GET /catalogue/services`, `/catalogue/categories`, `/catalogue/bundles`, `/catalogue/search` |
| **Projects** | `GET /projects`, `GET /projects/:id`, `PATCH /projects/:id/status`, `GET /projects/:id/milestones` |
| **Engagements** | `POST /engagements`, `GET /engagements`, `GET /engagements/:id` |
| **Contracts** | `POST /contracts`, `GET /contracts/:id`, `POST /contracts/:id/pdf` |
| **Invoices** | `GET /invoices`, `POST /invoices`, `PATCH /invoices/:id/utr` |
| **Finance** | `GET /finance/ar-aging`, `/finance/wip`, `/finance/rev-rec`, `/finance/gstr1` |
| **Tasks** | `GET /tasks/my`, `POST /tasks`, `PUT /tasks/:id` |
| **Timesheets** | `GET /timesheets`, `POST /timesheets/:id/approve-all` |
| **Tickets** | `POST /support`, `GET /support`, `GET /tickets`, `PATCH /tickets/:id/resolve` |
| **Files** | `GET /files`, `POST /files/upload`, `DELETE /files/:id` |
| **Messages** | `GET /messages/conversations`, `POST /messages/send` |
| **Notifications** | `GET /notifications`, `PUT /notifications/:id/read` |
| **Feedback** | `GET /feedback`, `POST /feedback` |
| **Change Requests** | `GET /change-requests`, `POST /change-requests`, `PATCH /change-requests/:id/assess` |
| **RFP** | `POST /rfps`, `PATCH /rfps/:id/decision`, `POST /rfps/:id/sdns` |
| **Users** | `GET /users`, `POST /users`, `PUT /users/:id`, `PUT /users/me` |
| **Analytics** | `GET /analytics/overview`, `/analytics/revenue`, `/analytics/conversion`, `/analytics/services` |
| **Admin** | `GET /admin/services`, `/admin/features`, `/admin/bundles`, `/admin/rate-cards`, `/admin/flags`, `/admin/se-queue`, `/admin/compliance`, `/admin/screening` |
| **Blog** | `GET /blog`, `GET /blog/:id`, `POST /blog/generate`, `POST /blog/suggest` |
| **Tools** | `POST /tools/audit`, `/tools/estimate`, `/tools/brief`, `/tools/legal` |

## Database Schema

Key Prisma models:

| Model | Purpose |
|-------|---------|
| `Org`, `User` | Identity and access control (18 roles) |
| `ServiceUnit`, `SdpVersion`, `FeatureUnit`, `Dependency` | Service catalog with SDP versioning |
| `Bundle`, `RateCard` | Bundled services and pricing |
| `Workspace`, `Estimate`, `CustomLine`, `SdnNote` | Builder and estimation |
| `Quote`, `Order` | Quotes and orders |
| `Engagement`, `Contract`, `Signature` | Engagements and contracts |
| `Project`, `Milestone`, `ChangeRequest` | Project lifecycle |
| `Invoice`, `Credit`, `RevrecLedger`, `WipLedger`, `Payment` | Finance and revenue recognition |
| `Timesheet`, `TimesheetLine` | Time and material tracking |
| `Ticket`, `TicketReply` | Support and bug tracking |
| `File`, `CredentialVault` | File storage and secrets |
| `Event` | Append-only event store (372 event codes) |
| `Program`, `Bench`, `Stakeholder` | Programs and resource bench |
| `Rfp`, `SdnNote` | RFP management |
| `Lead`, `Referral`, `Feedback` | CRM and referrals |
| `Job`, `JobApplication` | Hiring pipeline |
| `Notification`, `Conversation`, `Message` | Messaging and notifications |
| `BlogPost`, `Guide`, `ChangelogVersion` | Content management |
| `Flag`, `NotificationContent`, `ComplianceItem`, `ScreeningResult` | Governance |
| `Review` | Performance reviews |
| `Package`, `Preview`, `Blueprint` | B2C packages and previews |
| `ShowcaseItem`, `Glossary` | Public showcase and glossary |

## Role-Based Access

| Role | Dashboard | Access |
|------|-----------|--------|
| `CLIENT`, `CLIENT_ADMIN`, `CLIENT_PM`, `INDIVIDUAL_CLIENT`, `ORG_OWNER` | `/app/client` | Client portal |
| `TEAM`, `PM`, `DEVELOPER`, `QA`, `DESIGNER`, `DEVOPS`, `SE`, `SENIOR_PM` | `/app/team` | Team dashboard |
| `ADMIN` | `/app/admin` | Admin dashboard |

## Deployment

### Build for Production

```bash
# Build monorepo
pnpm build

# Build client
cd client && pnpm build && cd ..
```

Build outputs:
- `apps/api/dist/` — compiled API server
- `apps/web/.next/` — Next.js production build
- `client/dist/` — static Vite build

### Run Production

```bash
# API
cd apps/api
node dist/server.js

# Web
cd apps/web
pnpm start

# Client — serve client/dist/ with nginx or any static file server
```

### Docker

```bash
# Client
docker build -f Dockerfile.client -t stackfox-client .
docker run -p 80:80 stackfox-client

# API (update Dockerfile.server to point to apps/api/)
docker build -f Dockerfile.server -t stackfox-api .
docker run -p 4000:4000 stackfox-api
```

### Cloud Deployment

| Service | Recommendation |
|---------|---------------|
| **API** | Railway, Render, or Fly.io |
| **Web** | Vercel (Next.js) |
| **Client** | Vercel (Vite/static) or nginx on any VPS |
| **Database** | Supabase (PostgreSQL) |
| **Redis** | Upstash |
| **Storage** | Cloudflare R2 |

## Project Structure

```
client/src/
├── app/
│   ├── client/         # Client dashboard pages
│   │   ├── ClientLayout.jsx
│   │   ├── Overview.jsx, Projects.jsx, Quotes.jsx, Invoices.jsx
│   │   ├── Files.jsx, Messages.jsx, Engagements.jsx, Contracts.jsx
│   │   ├── Timesheets.jsx, Notifications.jsx, Support.jsx, Cart.jsx
│   │   ├── Profile.jsx, Milestones.jsx, Workspace.jsx, Referrals.jsx
│   │   ├── Feedback.jsx
│   │   └── ClientPanels.jsx  # Activity, Changes, Reports, Handover
│   ├── team/           # Team dashboard pages
│   │   ├── TeamLayout.jsx
│   │   ├── Dashboard.jsx, Tasks.jsx, Projects.jsx, Timesheets.jsx
│   │   ├── Calendar.jsx, Reviews.jsx, Knowledge.jsx, Profile.jsx
│   │   └── PmDashboards.jsx  # Queue, Sprints, Resources, Quality,
│   │                          # Finance, Clients, Analysis, SEQueue
│   └── admin/          # Admin dashboard pages
│       ├── AdminLayout.jsx
│       ├── Overview.jsx, Catalog.jsx, Users.jsx, Orders.jsx
│       ├── Projects.jsx, Analytics.jsx, Hiring.jsx, Content.jsx
│       ├── ProjectWall.jsx, Engagements.jsx, Finance.jsx
│       ├── Notifications.jsx, RFPs.jsx, Referrals.jsx
│       ├── Reports.jsx, Settings.jsx
│       └── Governance.jsx  # Flags, Pricing, Templates, Compliance, Screening
├── pages/              # Public marketing pages
│   ├── Home.jsx, About.jsx, Services.jsx, Pricing.jsx
│   ├── ServiceCost.jsx, ServiceTimeline.jsx
│   ├── ExpressCheckout.jsx, Quiz.jsx
│   ├── Roadmap.jsx, Changelog.jsx, Guides.jsx
│   ├── GuideDetail.jsx, BundleDetail.jsx, Help.jsx, Demo.jsx
│   └── tools/          # Acquisition tools
│       ├── WebsiteAudit.jsx, Estimator.jsx, BriefBuilder.jsx
│       ├── LegalStarterPack.jsx, GSTInvoice.jsx
├── components/         # Shared UI components
├── store/              # Zustand stores (auth, cart, UI)
├── lib/                # API client, utils, hooks
└── routes.jsx          # Route definitions

apps/api/src/
├── routes/             # Fastify route handlers (30+ modules)
├── workers/            # BullMQ background workers
├── plugins/            # Fastify plugins (auth, CORS, etc.)
├── lib/                # Utilities (events, queue, payments, storage)
└── server.ts           # App entry point

packages/
├── prisma/             # Prisma schema, migrations, seed
└── core/               # Shared TypeScript types and validators
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run lint and typecheck:
   ```bash
   pnpm lint
   pnpm typecheck
   ```
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## License

Proprietary — StackFox
