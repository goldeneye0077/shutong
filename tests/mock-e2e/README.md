# Mock E2E Tests

This suite runs the real frontend, backend, data-service, PostgreSQL, file upload, job queue, parsing, inspection, workflow, report, AI summary, and audit flow with mock business data.

## Run Against Existing Services

Start the project first:

```bash
docker compose up --build -d
```

Then run:

```bash
pnpm test:mock:e2e
```

Default URLs:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8000/api/v1`
- Data-service: `http://localhost:8010`

Override them with `E2E_FRONTEND_URL`, `E2E_BACKEND_URL`, and `E2E_DATA_SERVICE_URL`.

## Run With Isolated Compose

```bash
pnpm test:mock:e2e:compose
```

This uses an isolated Compose project and ports `25173`, `28000`, `28010`, and `25432`, then removes containers and volumes after the run. Set `E2E_KEEP_COMPOSE=1` to keep the stack for debugging.

## Browser

On Windows the Playwright config uses the installed Edge channel by default. On other systems, install Chromium once:

```bash
pnpm exec playwright install chromium
```

You can force a channel with `E2E_BROWSER_CHANNEL=chrome` or `E2E_BROWSER_CHANNEL=msedge`.
