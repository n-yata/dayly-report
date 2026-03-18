# Set via environment: export PROJECT_ID=your-gcp-project-id
# Or create .env.local with: PROJECT_ID=your-gcp-project-id
-include .env.local
PROJECT_ID   ?=
SERVICE_NAME := dayly-report
REGION       := asia-northeast1
IMAGE        := asia-northeast1-docker.pkg.dev/$(PROJECT_ID)/$(SERVICE_NAME)/app

# ── Local ─────────────────────────────────────────────────────────────────────

.PHONY: dev
dev:
	npm run dev

.PHONY: lint
lint:
	npm run lint

.PHONY: test
test:
	npm test

.PHONY: build
build:
	npm run build

# ── DB ────────────────────────────────────────────────────────────────────────

.PHONY: db-up
db-up:
	docker compose up -d db

.PHONY: db-down
db-down:
	docker compose down

.PHONY: db-migrate
db-migrate:
	npx prisma migrate dev

.PHONY: db-seed
db-seed:
	npx prisma db seed

.PHONY: db-reset
db-reset:
	npx prisma migrate reset

.PHONY: db-studio
db-studio:
	npx prisma studio

.PHONY: db-setup
db-setup: db-up db-migrate db-seed

# ── Docker ────────────────────────────────────────────────────────────────────

.PHONY: docker-build
docker-build:
	docker build -t $(IMAGE):latest .

.PHONY: docker-push
docker-push:
	docker push $(IMAGE):latest

.PHONY: docker-run
docker-run:
	docker run --rm -p 8080:8080 --env-file .env.local $(IMAGE):latest

# ── GCP ───────────────────────────────────────────────────────────────────────

.PHONY: gcp-auth
gcp-auth:
	gcloud auth configure-docker asia-northeast1-docker.pkg.dev

.PHONY: deploy
deploy: docker-build docker-push
	gcloud run deploy $(SERVICE_NAME) \
		--image $(IMAGE):latest \
		--project $(PROJECT_ID) \
		--region $(REGION) \
		--platform managed \
		--allow-unauthenticated \
		--port 8080

.PHONY: deploy-status
deploy-status:
	gcloud run services describe $(SERVICE_NAME) \
		--project $(PROJECT_ID) \
		--region $(REGION) \
		--format "value(status.url)"

.PHONY: logs
logs:
	gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=$(SERVICE_NAME)" \
		--project $(PROJECT_ID) \
		--limit 50 \
		--format "value(textPayload)"
