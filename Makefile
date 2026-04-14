SHELL := /bin/sh

.PHONY: up down logs format lint test

up:
	docker compose up --build

down:
	docker compose down

logs:
	docker compose logs -f

lint:
	@echo "Run domain-specific linters after dependencies are installed."

test:
	@echo "Run backend, data-service, and frontend tests after dependencies are installed."

