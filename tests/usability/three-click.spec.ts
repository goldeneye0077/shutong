import { expect, test, type Page } from "@playwright/test";

const frontendBaseUrl = (process.env.E2E_FRONTEND_URL ?? "http://localhost:5173").replace(/\/+$/, "");

const reachablePages = [
  { label: "值守总览", path: "/", evidence: "值守总览" },
  { label: "对象配置", path: "/assets", evidence: "对象配置" },
  { label: "规则巡检", path: "/rules", evidence: "规则巡检" },
  { label: "闭环处置", path: "/workflow", evidence: "闭环处置" },
  { label: "报告中心", path: "/reports", evidence: "报告中心" },
  { label: "审计日志", path: "/audit", evidence: "审计日志" },
  { label: "平台管理", path: "/platform", evidence: "平台管理" },
];

test.describe("M14-12 三次点击可达性验收", () => {
  test("高频页面从工作台导航 1 次点击可达", async ({ page }) => {
    await login(page);

    const results: Array<{ label: string; clicks: number; path: string }> = [];
    for (const target of reachablePages) {
      let clicks = 0;
      const link = page.locator(".shell-nav-link", { hasText: target.label }).first();
      await expect(link).toBeVisible();
      await link.click();
      clicks += 1;

      await expect(page).toHaveURL(new RegExp(`${escapeRegExp(target.path)}$`));
      await expect(page.getByText(target.evidence, { exact: false }).first()).toBeVisible();
      expect(clicks, `${target.label} 应在 3 次点击内可达`).toBeLessThanOrEqual(3);
      results.push({ label: target.label, clicks, path: target.path });
    }

    console.table(results);
  });

  test("主题切换与消息中心不阻塞主导航", async ({ page }) => {
    await login(page);
    const initialTheme = await page.locator("html").getAttribute("data-shell-theme");

    await page.locator(".shell-topbar-actions .shell-icon-button").nth(1).click();
    await expect.poll(() => page.locator("html").getAttribute("data-shell-theme")).not.toBe(initialTheme);

    await page.locator(".shell-topbar-actions .shell-icon-button").first().click();
    await expect(page.getByText("消息中心", { exact: false })).toBeVisible();

    await page.locator(".shell-nav-link", { hasText: "对象配置" }).first().click();
    await expect(page).toHaveURL(/\/assets$/);
    await expect(page.getByText("对象配置", { exact: false }).first()).toBeVisible();
  });
});

async function login(page: Page): Promise<void> {
  await page.goto(`${frontendBaseUrl}/login`);
  await page.locator("#username").fill(process.env.E2E_USERNAME ?? "admin");
  await page.locator("#password").fill(process.env.E2E_PASSWORD ?? "admin123");
  await page.locator("form button[type='submit']").click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator(".shell-nav")).toBeVisible();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
