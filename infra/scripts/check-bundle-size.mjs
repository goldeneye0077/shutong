import { readdir, stat, writeFile, mkdir } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import path from "node:path";

const distAssetsDir = path.resolve("apps/frontend/dist/assets");
const reportPath = process.env.BUNDLE_REPORT_PATH ?? "docs/04-structure/frontend-bundle-report.md";
const maxJsChunkKb = Number.parseInt(process.env.BUNDLE_MAX_JS_CHUNK_KB ?? "600", 10);
const maxCssChunkKb = Number.parseInt(process.env.BUNDLE_MAX_CSS_CHUNK_KB ?? "380", 10);

async function main() {
  const entries = await readdir(distAssetsDir);
  const assets = [];
  for (const entry of entries) {
    const filePath = path.join(distAssetsDir, entry);
    const info = await stat(filePath);
    if (!info.isFile() || (!entry.endsWith(".js") && !entry.endsWith(".css"))) {
      continue;
    }
    const raw = readFileSync(filePath);
    assets.push({
      name: entry,
      type: entry.endsWith(".js") ? "js" : "css",
      bytes: info.size,
      gzipBytes: gzipSync(raw).length,
    });
  }

  assets.sort((left, right) => right.bytes - left.bytes);
  const oversize = assets.filter((asset) => {
    const limit = asset.type === "js" ? maxJsChunkKb : maxCssChunkKb;
    return asset.bytes > limit * 1024;
  });

  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, buildReport(assets, oversize), "utf8");

  console.log(`Bundle report written to ${reportPath}`);
  for (const asset of assets.slice(0, 10)) {
    console.log(`${asset.name}: ${formatKb(asset.bytes)} raw / ${formatKb(asset.gzipBytes)} gzip`);
  }

  if (oversize.length > 0) {
    console.error("Bundle budget exceeded:");
    for (const asset of oversize) {
      const limit = asset.type === "js" ? maxJsChunkKb : maxCssChunkKb;
      console.error(`- ${asset.name}: ${formatKb(asset.bytes)} > ${limit}KB`);
    }
    process.exit(1);
  }
}

function buildReport(assets, oversize) {
  const totalJs = sumBytes(assets.filter((asset) => asset.type === "js"), "bytes");
  const totalCss = sumBytes(assets.filter((asset) => asset.type === "css"), "bytes");
  const totalGzip = sumBytes(assets, "gzipBytes");
  return [
    "# M14-12 前端包体积报告",
    "",
    `- 生成时间：${new Date().toLocaleString("zh-CN", { hour12: false })}`,
    `- JS 单 chunk 预算：${maxJsChunkKb}KB`,
    `- CSS 单 chunk 预算：${maxCssChunkKb}KB`,
    `- JS 总大小：${formatKb(totalJs)}`,
    `- CSS 总大小：${formatKb(totalCss)}`,
    `- gzip 总大小：${formatKb(totalGzip)}`,
    `- 预算结论：${oversize.length === 0 ? "通过" : `未通过（${oversize.length} 个文件超限）`}`,
    "",
    "## 产物明细",
    "",
    "| 文件 | 类型 | 原始大小 | gzip 大小 |",
    "|------|------|----------|-----------|",
    ...assets.map((asset) => `| ${asset.name} | ${asset.type} | ${formatKb(asset.bytes)} | ${formatKb(asset.gzipBytes)} |`),
    "",
  ].join("\n");
}

function sumBytes(items, field) {
  return items.reduce((sum, item) => sum + item[field], 0);
}

function formatKb(bytes) {
  return `${(bytes / 1024).toFixed(2)}KB`;
}

await main();
