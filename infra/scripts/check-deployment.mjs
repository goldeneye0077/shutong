const frontendUrl = process.env.FRONTEND_URL ?? `http://localhost:${process.env.FRONTEND_PORT ?? "5173"}`;
const backendUrl = process.env.BACKEND_URL ?? `http://localhost:${process.env.BACKEND_PORT ?? "8000"}`;
const dataServiceUrl = process.env.DATA_SERVICE_URL ?? `http://localhost:${process.env.DATA_SERVICE_PORT ?? "8010"}`;
const username = process.env.BACKEND_BOOTSTRAP_ADMIN_USERNAME ?? "admin";
const password = process.env.BACKEND_BOOTSTRAP_ADMIN_PASSWORD ?? "admin123";

async function check(name, action) {
  try {
    await action();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`);
  }
  return response.json();
}

await check("backend system summary", async () => {
  const payload = await getJson(`${backendUrl}/api/v1/system/summary`);
  if (!payload.frontend_boundary || !payload.backend_boundary || !payload.data_service_boundary) {
    throw new Error("system summary boundary fields are missing");
  }
});

let accessToken = "";

await check("backend login", async () => {
  const response = await fetch(`${backendUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) {
    throw new Error(`login returned ${response.status}`);
  }
  const payload = await response.json();
  if (!payload.access_token || !payload.user?.username) {
    throw new Error("login response is missing token or user");
  }
  accessToken = payload.access_token;
});

await check("backend authenticated profile", async () => {
  const response = await fetch(`${backendUrl}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(`auth/me returned ${response.status}`);
  }
  const payload = await response.json();
  if (payload.username !== username) {
    throw new Error(`unexpected authenticated user: ${payload.username}`);
  }
});

await check("data-service health", async () => {
  const payload = await getJson(`${dataServiceUrl}/internal/health`);
  if (payload.status !== "ok") {
    throw new Error(`unexpected data-service status: ${payload.status}`);
  }
});

await check("data-service capabilities", async () => {
  const payload = await getJson(`${dataServiceUrl}/internal/capabilities`);
  const jobTypes = payload.supported_job_types ?? payload.job_types;
  if (!Array.isArray(jobTypes) || !jobTypes.includes("parse_config")) {
    throw new Error("data-service capabilities are incomplete");
  }
});

await check("frontend html", async () => {
  const response = await fetch(frontendUrl);
  if (!response.ok) {
    throw new Error(`frontend returned ${response.status}`);
  }
  const html = await response.text();
  if (!html.includes("<div id=\"root\"></div>")) {
    throw new Error("frontend root element not found");
  }
});

if (process.exitCode) {
  console.error("\nDeployment acceptance failed.");
  process.exit(process.exitCode);
}

console.log("\nDeployment acceptance passed.");
