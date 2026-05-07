# ActionBenchAI — Court Judgment Intelligence System

## Overview

Full-stack government portal for India's Centre for e-Governance.
Processes court judgments via AI (Claude) to extract structured data and generate compliance action plans.
Previously named "JudgeAI".

## Architecture

pnpm monorepo with TypeScript. Each package manages its own dependencies.

### Artifacts
- `artifacts/judge-ai` — React + Vite frontend (port 22040, preview at `/`)
- `artifacts/api-server` — Express 5 REST API backend (port 8080, routes at `/api`)

### Libs
- `lib/db` — PostgreSQL + Drizzle ORM schema (6 tables)
- `lib/api-spec` — OpenAPI 3.0 spec (`openapi.yaml`)
- `lib/api-zod` — Generated Zod schemas from OpenAPI (via Orval)
- `lib/api-client-react` — Generated React Query hooks from OpenAPI (via Orval)
- `lib/integrations-anthropic-ai` — Anthropic Claude AI client

## Stack

- **Monorepo**: pnpm workspaces
- **Node.js**: 24
- **TypeScript**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (v4), drizzle-zod
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild
- **Frontend**: React 19 + Vite + TailwindCSS v4 + shadcn/ui
- **Auth**: JWT (jsonwebtoken + bcryptjs), Bearer tokens stored in localStorage
- **AI**: Anthropic Claude (`claude-sonnet-4-6`) via Replit AI Integrations

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run build` — build API server

## Database Schema (lib/db/src/schema/)

- `users` — id, name, email, passwordHash, role (UPLOADER/REVIEWER/VIEWER), department, createdAt
- `judgments` — id, caseNumber, courtName, pdfPath, uploadedBy, status, errorMessage, uploadedAt
- `extractions` — AI-extracted data: caseTitle, bench, keyDirections[], timelines[], aiConfidenceScore
- `action_plans` — AI-generated: priorityLevel, complianceRequired, appealDeadline, actionItems[]
- `verification_records` — reviewer decisions: APPROVED/EDITED/REJECTED with reviewer notes
- `dashboard_entries` — denormalized view for decision-maker dashboard

## Auth Roles

- `UPLOADER` — can upload PDFs, view own uploads
- `REVIEWER` — can review extraction queue, approve/edit/reject
- `VIEWER` — read-only dashboard access

## AI Processing Pipeline (api-server/src/lib/pipeline.ts)

1. PDF text extraction via `pdf-parse`
2. Claude extraction — structured JSON with case data, key directions, timelines
3. Claude action plan — priority level, compliance check, appeal deadline, action items
4. Both stored in DB; judgment status moves to `EXTRACTED`
5. Reviewer verifies → creates `verification_record` + `dashboard_entry`

## Demo Users (seeded)

- `uploader@judgeai.gov.in` / `demo1234` — UPLOADER (Maharashtra Legal Cell)
- `reviewer@judgeai.gov.in` / `demo1234` — REVIEWER (Karnataka State Authority)
- `viewer@judgeai.gov.in` / `demo1234` — VIEWER (Central Decision Committee)

## Frontend Pages

- `/login` — JWT auth, register/sign-in tabs
- `/upload` — PDF drag-and-drop upload with real-time processing status
- `/verify` — Reviewer queue table (auto-refreshes)
- `/verify/:id` — Side-by-side PDF viewer + AI extraction editor + action plan review
- `/dashboard` — Government decision-maker view with filters, charts, and deadline tracking

## Environment Variables

- `DATABASE_URL` — PostgreSQL connection string
- `SESSION_SECRET` — JWT signing secret
- `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` — Anthropic proxy URL
- `AI_INTEGRATIONS_ANTHROPIC_API_KEY` — Anthropic proxy API key

## Color Theme

Primary: `#1a3c6e` (navy blue), Accent: `#f59e0b` (amber)
