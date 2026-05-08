# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Application: Jira Migration Audit

A web tool for auditing Jira DC/Server instances to identify migration blockers and risks before moving to Jira Cloud.

### Features
- Connect to any Jira DC/Server instance via REST API (basic auth or PAT)
- Run a full automated audit covering 9 categories: System Info, Plugins/Apps, Custom Fields, Workflows, Projects, Users, Data Volume, Permissions, Automation
- Migration readiness score (0–100) with color-coded readiness levels
- Blocker/warning/info severity breakdown with migration notes
- Per-category breakdown with individual scores
- Audit session history with delete support
- Aggregate stats dashboard

### Architecture
- **Frontend**: `artifacts/jira-audit` — React + Vite, wouter routing, TanStack Query, shadcn/ui
- **Backend**: `artifacts/api-server` — Express 5, Drizzle ORM, PostgreSQL
- **Jira client**: `artifacts/api-server/src/lib/jira-client.ts` — REST API client for Jira DC/Server
- **Audit engine**: `artifacts/api-server/src/lib/audit-engine.ts` — runs audits asynchronously, saves findings to DB
- **DB schema**: `lib/db/src/schema/audit.ts` — audit_sessions + audit_findings tables

### API Routes (all under /api)
- `POST /audit/connect` — test Jira connectivity
- `GET /audit/sessions` — list all past audits
- `POST /audit/sessions` — start a new audit (async, fire-and-forget)
- `GET /audit/sessions/stats` — aggregate stats
- `GET /audit/sessions/:id` — full session with findings
- `DELETE /audit/sessions/:id` — delete session
- `GET /audit/sessions/:id/summary` — readiness summary + category breakdown
- `GET /audit/sessions/:id/blockers` — blocker-only findings
