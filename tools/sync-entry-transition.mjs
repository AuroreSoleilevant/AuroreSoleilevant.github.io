import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const snippetPath = path.join(root, "outil", "entry-transition.inc");
const snippet = (await readFile(snippetPath, "utf8")).trim();
const normalizedSnippet = snippet.replaceAll("\r\n", "\n");
const loaderPattern = /<script\s+src="\/js\/(?:common-head\.js|special\/common-head-peur\.js)"[^>]*><\/script>/;
const blockPattern = /<!-- spica-entry-transition:start -->[\s\S]*?<!-- spica-entry-transition:end -->/;
let publicPages = 0;
let updatedPages = 0;

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if ([".git", "node_modules"].includes(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await walk(absolute);
      continue;
    }
    if (!entry.isFile() || path.extname(entry.name) !== ".html") continue;

    const source = await readFile(absolute, "utf8");
    const loaderMatch = source.match(loaderPattern);
    if (!loaderMatch) continue;
    publicPages += 1;

    const currentBlock = source.match(blockPattern)?.[0];
    const newline = source.includes("\r\n") ? "\r\n" : "\n";
    const renderedSnippet =
      newline === "\r\n" ? normalizedSnippet.replaceAll("\n", "\r\n") : normalizedSnippet;
    if (currentBlock === renderedSnippet) continue;

    let updatedSource;
    if (currentBlock) {
      updatedSource = source.replace(blockPattern, renderedSnippet);
    } else {
      const loaderIndex = source.indexOf(loaderMatch[0]);
      const lineStart = source.lastIndexOf(newline, loaderIndex) + newline.length;
      updatedSource =
        source.slice(0, lineStart) + renderedSnippet + newline + source.slice(lineStart);
    }
    await writeFile(absolute, updatedSource, "utf8");
    updatedPages += 1;
  }
}

await walk(root);
console.log(`入站动画同步完成：更新 ${updatedPages}/${publicPages} 个公开页面。`);
