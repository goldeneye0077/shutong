import { access, readFile } from "node:fs/promises";

const requiredFiles = [
  "README.md",
  ".env.example",
  "compose.yaml",
  "Makefile",
  "package.json",
  "apps/frontend/Dockerfile",
  "apps/backend/Dockerfile",
  "apps/data-service/Dockerfile",
  "apps/backend/alembic/versions/20260427_0001_initial_schema.py",
  "docs/04-structure/production-delivery-checklist.md",
  "docs/04-structure/performance-acceptance-report.md",
  "docs/04-structure/frontend-bundle-report.md",
  "docs/04-structure/release-candidate-checklist.md",
  "infra/scripts/check-deployment.mjs",
  "infra/scripts/check-migrations.py",
  "infra/scripts/check-api-contracts.py",
  "infra/scripts/check-bundle-size.mjs",
  "infra/scripts/reset-demo-data.mjs",
  "tests/performance/run-acceptance.mjs",
  "tests/usability/three-click.spec.ts",
  "packages/api-contracts/openapi.json",
  "packages/api-contracts/generated.ts",
];

const requiredPackageScripts = [
  "deploy:check",
  "migrations:check",
  "contracts:check",
  "bundle:report",
  "test:regression",
  "test:performance",
  "test:usability",
  "test:acceptance",
  "test:mock:e2e:compose",
  "seed:demo",
  "demo:reset",
  "release:check",
];

const requiredIgnorePatterns = [
  "storage/uploads/*",
  "storage/exports/*",
  "tests/mock-e2e/.playwright-report/",
  "tests/mock-e2e/.test-results/",
  "tests/usability/.playwright-report/",
  "tests/usability/.test-results/",
  "tests/performance/.last-result.json",
];

const requiredComposeTokens = [
  "postgres:",
  "backend:",
  "data-service:",
  "frontend:",
  "healthcheck:",
  "condition: service_healthy",
];

async function main() {
  const failures = [];

  for (const file of requiredFiles) {
    try {
      await access(file);
      pass(`file ${file}`);
    } catch {
      failures.push(`缺少必要文件：${file}`);
    }
  }

  const packageJson = JSON.parse(await readFile("package.json", "utf8"));
  const scripts = packageJson.scripts ?? {};
  for (const scriptName of requiredPackageScripts) {
    if (scripts[scriptName]) {
      pass(`script ${scriptName}`);
    } else {
      failures.push(`package.json 缺少脚本：${scriptName}`);
    }
  }

  const gitignore = await readFile(".gitignore", "utf8");
  for (const pattern of requiredIgnorePatterns) {
    if (gitignore.includes(pattern)) {
      pass(`ignore ${pattern}`);
    } else {
      failures.push(`.gitignore 缺少忽略规则：${pattern}`);
    }
  }

  const compose = await readFile("compose.yaml", "utf8");
  for (const token of requiredComposeTokens) {
    if (compose.includes(token)) {
      pass(`compose ${token}`);
    } else {
      failures.push(`compose.yaml 缺少关键配置：${token}`);
    }
  }

  const readme = await readFile("README.md", "utf8");
  for (const token of ["发布候选", "docker compose up --build -d", "pnpm test:regression", "pnpm test:acceptance"]) {
    if (readme.includes(token)) {
      pass(`README ${token}`);
    } else {
      failures.push(`README.md 缺少发布说明片段：${token}`);
    }
  }

  if (failures.length > 0) {
    console.error("\nRelease candidate check failed:");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log("\nRelease candidate lightweight check passed.");
}

function pass(label) {
  console.log(`PASS ${label}`);
}

await main();
