SHELL := /bin/sh

.PHONY: up down logs contracts-check migrations-check deploy-check deployment-check performance usability bundle-report acceptance release-check demo-reset regression lint test

up:
	docker compose up --build

down:
	docker compose down

logs:
	docker compose logs -f

contracts-check:
	pnpm contracts:check

migrations-check:
	pnpm migrations:check

deploy-check:
	pnpm deploy:check

deployment-check:
	pnpm deploy:check

performance:
	pnpm test:performance

usability:
	pnpm test:usability

bundle-report:
	pnpm bundle:report

acceptance:
	pnpm test:acceptance

release-check:
	pnpm release:check

demo-reset:
	pnpm demo:reset

regression:
	pnpm test:regression

lint:
	pnpm --dir apps/frontend lint

test:
	pnpm test:regression
