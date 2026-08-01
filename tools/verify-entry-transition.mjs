import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const snippetPath = path.join(root, "outil", "entry-transition.inc");
const snippet = (await readFile(snippetPath, "utf8")).trim();
const loaderPattern = /<script\s+src="\/js\/(?:common-head\.js|special\/common-head-peur\.js)"[^>]*><\/script>/;
const errors = [];
let publicPages = 0;

const inlineScript = snippet.match(/<script\s+data-spica-entry-bootstrap>([\s\S]*?)<\/script>/)?.[1];
if (!inlineScript) {
  errors.push("标准入站片段缺少启动脚本。");
} else {
  try {
    new Function(inlineScript);
  } catch (error) {
    errors.push(`标准入站启动脚本无法解析：${error.message}`);
  }
}

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if ([".git", "node_modules"].includes(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await walk(absolute);
      continue;
    }
    if (!entry.isFile() || entry.name !== "index.html") continue;

    const source = await readFile(absolute, "utf8");
    const loaderMatch = source.match(loaderPattern);
    if (!loaderMatch) continue;
    publicPages += 1;
    const relative = path.relative(root, absolute).replaceAll("\\", "/");
    const snippetIndex = source.indexOf(snippet);
    const loaderIndex = source.indexOf(loaderMatch[0]);
    if (snippetIndex === -1) {
      errors.push(`${relative}：缺少或偏离标准入站启动片段。`);
    } else if (snippetIndex > loaderIndex) {
      errors.push(`${relative}：入站启动片段必须位于 Loader 之前。`);
    }
    if ((source.match(/spica-entry-transition:start/g) || []).length !== 1) {
      errors.push(`${relative}：入站启动片段标记数量不是 1。`);
    }
  }
}

await walk(root);

if (errors.length) {
  console.error(`入站动画一致性校验失败：${errors.length} 个问题。`);
  for (const error of errors) console.error(`ERROR ${error}`);
  process.exitCode = 1;
} else {
  console.log(`入站动画一致性校验通过：${publicPages} 个公开页面。`);
}
