import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { readdir, rm } from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const args = new Set(process.argv.slice(2));
const force = args.has("--force") || process.env.DEMO_RESET_CONFIRM === "reset-demo-data";
const shouldSeed = args.has("--seed") || process.env.DEMO_RESET_SEED === "1";
const demoPrefix = process.env.DEMO_SEED_PREFIX ?? "发布候选演示";

if (!force) {
  console.error("Refusing to reset demo data without --force or DEMO_RESET_CONFIRM=reset-demo-data.");
  process.exit(1);
}

const envValues = {
  ...readEnvFile(".env.example"),
  ...readEnvFile(".env"),
  ...process.env,
};

const postgresUser = envValues.POSTGRES_USER ?? "network_compliance";
const postgresDb = envValues.POSTGRES_DB ?? "network_compliance";

const businessTables = [
  "ticket_reminders",
  "ticket_attachments",
  "exceptions",
  "tickets",
  "rule_run_results",
  "report_artifacts",
  "parse_runs",
  "normalized_configs",
  "findings",
  "ai_analysis_jobs",
  "notifications",
  "log_clues",
  "ledger_items",
  "audit_events",
  "config_files",
  "inspection_runs",
  "report_jobs",
  "rule_set_versions",
  "rule_sets",
  "scheduled_tasks",
  "job_queue",
  "assets",
];

const truncateSql = `TRUNCATE TABLE ${businessTables.join(", ")} RESTART IDENTITY CASCADE;`;

console.log("Resetting demo business tables...");
run("docker", [
  "compose",
  "exec",
  "-T",
  "postgres",
  "psql",
  "-U",
  postgresUser,
  "-d",
  postgresDb,
  "-v",
  "ON_ERROR_STOP=1",
  "-c",
  truncateSql,
]);

await cleanStorageDir("storage/uploads");
await cleanStorageDir("storage/exports");

if (shouldSeed) {
  console.log(`Seeding clean demo data with prefix: ${demoPrefix}`);
  run("pnpm", ["seed:demo"], {
    env: {
      ...process.env,
      SEED_PREFIX: demoPrefix,
    },
  });
}

console.log("Demo data reset completed.");

function run(command, commandArgs, options = {}) {
  const executable = process.platform === "win32" && command === "pnpm" ? "cmd.exe" : command;
  const argsForSpawn = process.platform === "win32" && command === "pnpm"
    ? ["/d", "/s", "/c", "pnpm", ...commandArgs]
    : commandArgs;
  const result = spawnSync(executable, argsForSpawn, {
    cwd: rootDir,
    env: {
      ...process.env,
      ...(options.env ?? {}),
    },
    stdio: "inherit",
    shell: false,
  });

  if (result.error) {
    throw result.error;
  }
  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1);
  }
}

async function cleanStorageDir(relativeDir) {
  const targetDir = path.resolve(rootDir, relativeDir);
  const storageRoot = path.resolve(rootDir, "storage");
  if (!targetDir.startsWith(storageRoot)) {
    throw new Error(`Refusing to clean outside storage: ${targetDir}`);
  }
  if (!existsSync(targetDir)) {
    return;
  }

  const entries = await readdir(targetDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === ".gitkeep") {
      continue;
    }
    const entryPath = path.join(targetDir, entry.name);
    await rm(entryPath, { recursive: true, force: true });
  }
  console.log(`Cleaned ${relativeDir}`);
}

function readEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return {};
  }
  const values = {};
  const content = readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const separator = trimmed.indexOf("=");
    if (separator === -1) {
      continue;
    }
    values[trimmed.slice(0, separator)] = trimmed.slice(separator + 1);
  }
  return values;
}
