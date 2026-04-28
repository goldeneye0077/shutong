import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const projectName = process.env.E2E_COMPOSE_PROJECT ?? "shutong-mock-e2e";
const frontendPort = process.env.E2E_FRONTEND_PORT ?? "25173";
const backendPort = process.env.E2E_BACKEND_PORT ?? "28000";
const dataServicePort = process.env.E2E_DATA_SERVICE_PORT ?? "28010";
const postgresPort = process.env.E2E_POSTGRES_PORT ?? "25432";

const frontendUrl = `http://localhost:${frontendPort}`;
const backendUrl = `http://localhost:${backendPort}`;
const dataServiceUrl = `http://localhost:${dataServicePort}`;

const env = {
  ...process.env,
  COMPOSE_PROJECT_NAME: projectName,
  POSTGRES_DB: "network_compliance_e2e",
  POSTGRES_USER: "network_compliance_e2e",
  POSTGRES_PASSWORD: "network_compliance_e2e",
  POSTGRES_PORT: postgresPort,
  BACKEND_PORT: backendPort,
  DATA_SERVICE_PORT: dataServicePort,
  FRONTEND_PORT: frontendPort,
  BACKEND_CORS_ORIGINS: `${frontendUrl},http://127.0.0.1:${frontendPort}`,
  VITE_API_BASE_URL: `${backendUrl}/api/v1`,
  DATA_SERVICE_ENABLE_BACKGROUND_WORKER: "false",
  E2E_FRONTEND_URL: frontendUrl,
  E2E_BACKEND_URL: `${backendUrl}/api/v1`,
  E2E_DATA_SERVICE_URL: dataServiceUrl,
};

let testStatus = 1;

try {
  run("docker", ["compose", "-p", projectName, "down", "-v", "--remove-orphans"], { allowFailure: true });
  run("docker", ["compose", "-p", projectName, "up", "--build", "-d"]);

  await waitForUrl(`${backendUrl}/api/v1/health`, "backend");
  await waitForUrl(`${dataServiceUrl}/internal/health`, "data-service");
  await waitForUrl(frontendUrl, "frontend");

  testStatus = run("pnpm", ["exec", "playwright", "test", "--config=tests/mock-e2e/playwright.config.ts"], {
    allowFailure: true,
  });

  if (testStatus !== 0) {
    run("docker", ["compose", "-p", projectName, "logs", "--tail", "160"], { allowFailure: true });
  }
} finally {
  if (process.env.E2E_KEEP_COMPOSE !== "1") {
    run("docker", ["compose", "-p", projectName, "down", "-v", "--remove-orphans"], { allowFailure: true });
  }
}

process.exit(testStatus);

function run(command, args, options = {}) {
  const executable = process.platform === "win32" && command === "pnpm" ? "cmd.exe" : command;
  const commandArgs = process.platform === "win32" && command === "pnpm" ? ["/d", "/s", "/c", "pnpm", ...args] : args;
  const result = spawnSync(executable, commandArgs, {
    cwd: rootDir,
    env,
    stdio: "inherit",
    shell: false,
  });

  if (result.error) {
    if (options.allowFailure) {
      console.error(result.error.message);
      return 1;
    }
    throw result.error;
  }

  const status = result.status ?? 1;
  if (status !== 0 && !options.allowFailure) {
    throw new Error(`${command} ${args.join(" ")} exited with ${status}`);
  }
  return status;
}

async function waitForUrl(url, label) {
  const deadline = Date.now() + 180_000;
  let lastError = "";

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
      lastError = `${response.status} ${response.statusText}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await delay(2_000);
  }

  throw new Error(`Timed out waiting for ${label} at ${url}. Last error: ${lastError}`);
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
