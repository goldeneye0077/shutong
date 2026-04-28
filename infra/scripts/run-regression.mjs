import { spawnSync } from "node:child_process";

const steps = [
  ["python", ["-m", "pytest", "apps/backend/tests/test_backend_api.py", "-q"]],
  ["python", ["-m", "pytest", "apps/data-service/tests/test_data_service.py", "-q"]],
  ["pnpm", ["migrations:check"]],
  ["pnpm", ["contracts:check"]],
  ["pnpm", ["--dir", "apps/frontend", "lint"]],
  ["pnpm", ["--dir", "apps/frontend", "build"]],
];

for (const [command, args] of steps) {
  console.log(`\n> ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, { stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log("\nRegression checks passed.");
