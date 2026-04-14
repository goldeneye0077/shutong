# Core Network Compliance Platform Monorepo

This repository implements the three-domain delivery model for the core network configuration security and compliance platform:

- `frontend`: React + Vite management UI with light and dark themes.
- `backend`: FastAPI business API, authentication, workflow orchestration, and audit boundary.
- `data-service`: ingestion, parsing, normalization, rule execution, scheduling, reporting, and AI-assisted jobs.

## Workspace layout

- `apps/frontend`: UI shell and feature modules.
- `apps/backend`: public API, RBAC, workflow state, and metadata management.
- `apps/data-service`: internal processing worker and health service.
- `packages/api-contracts`: generated frontend contract types.
- `packages/ui-tokens`: shared theme tokens.
- `docs`: requirements, architecture, proposals, and repository structure.
- `storage`: local uploads and exports mounted into containers.

## Operating model

- The frontend only talks to the backend public API under `/api/v1`.
- The backend persists user-facing state and creates rows in `job_queue`.
- The data-service claims jobs from PostgreSQL using `FOR UPDATE SKIP LOCKED`, performs work, and writes results back.
- AI-assisted analysis is explicitly post-MVP and cannot publish end-user results without human confirmation.

## Quick start

1. Copy `.env.example` to `.env` and adjust local values.
2. Start infrastructure with `docker compose up --build`.
3. Implement domain modules following the ordered proposal files in `docs/03-proposals`.

