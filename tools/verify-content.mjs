#!/usr/bin/env node

/**
 * 静态网站内容校验器。
 *
 * 只使用 Node.js 内置模块，只读取仓库文件；没有自动修复模式。
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const rootDirectory = resolve(scriptDirectory, "..");
const ignoredSubsitePrefixes = ["/SpicaRF/", "/NELC_site/"];
const externalUrlPattern = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;
const assetAttributePattern = /\b(?:href|src)\s*=\s*(["'])(.*?)\1/gi;
const srcsetAttributePattern = /\bsrcset\s*=\s*(["'])(.*?)\1/gi;

let checks = 0;
let warnings = 0;
let errors = 0;

function displayPath(path) {
  return relative(rootDirectory, path).split(sep).join("/") || ".";
}

function ok(message) {
  console.log(`OK    ${message}`);
}

function warning(source, message) {
  warnings += 1;
  console.warn(`WARN  [${source}] ${message}`);
}

function error(source, message) {
  errors += 1;
  console.error(`ERROR [${source}] ${message}`);
}

function check(label, callback) {
  checks += 1;
  try {
    callback();
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : String(caught);
    error(label, `检查无法完成：${message}`);
  }
}

function readJson(relativeFile) {
  const absoluteFile = join(rootDirectory, relativeFile);
  try {
    return JSON.parse(readFileSync(absoluteFile, "utf8"));
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : String(caught);
    error(relativeFile, `JSON 无法解析：${message}`);
    return null;
  }
}

function listFiles(directory, predicate) {
  const result = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      result.push(...listFiles(fullPath, predicate));
    } else if (predicate(fullPath)) {
      result.push(fullPath);
    }
  }
  return result;
}

function isIgnoredSubsite(urlPath) {
  return ignoredSubsitePrefixes.some(
    (prefix) => urlPath === prefix.slice(0, -1) || urlPath.startsWith(prefix),
  );
}

function cleanUrlPath(rawUrl) {
  const withoutFragmentOrQuery = rawUrl
    .split(/[?#]/, 1)[0]
    .trim()
    .replace(/\\/g, "/");
  if (!withoutFragmentOrQuery) return null;
  try {
    return decodeURIComponent(withoutFragmentOrQuery);
  } catch {
    return withoutFragmentOrQuery;
  }
}

function localUrlCandidates(rawUrl, sourceFile) {
  const urlPath = cleanUrlPath(rawUrl);
  if (!urlPath || externalUrlPattern.test(urlPath) || urlPath.startsWith("#")) {
    return { ignored: true, candidates: [] };
  }
  if (isIgnoredSubsite(urlPath)) return { ignored: true, candidates: [] };

  const baseDirectory = dirname(sourceFile);
  const initialPath = urlPath.startsWith("/")
    ? resolve(rootDirectory, `.${urlPath}`)
    : resolve(baseDirectory, urlPath);
  const normalizedRoot = `${rootDirectory}${sep}`;

  if (initialPath !== rootDirectory && !initialPath.startsWith(normalizedRoot)) {
    return { ignored: false, candidates: [], unsafe: true };
  }

  const candidates = [initialPath];
  if (!extname(initialPath)) {
    candidates.push(join(initialPath, "index.html"));
    candidates.push(`${initialPath}.html`);
  }
  return { ignored: false, candidates, unsafe: false };
}

function ensureLocalUrl(source, field, rawUrl, sourceFile) {
  const result = localUrlCandidates(rawUrl, sourceFile);
  if (result.ignored) return;
  if (result.unsafe) {
    error(source, `${field} 指向了仓库外路径：${rawUrl}`);
    return;
  }
  if (!result.candidates.some((candidate) => existsSync(candidate))) {
    error(source, `${field} 指向的本地路径不存在：${rawUrl}`);
  }
}

function validateDeclaredLocalValues(value, source, sourceFile, pathLabel = "") {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      validateDeclaredLocalValues(item, source, sourceFile, `${pathLabel}[${index}]`),
    );
    return;
  }
  if (!value || typeof value !== "object") return;

  for (const [key, child] of Object.entries(value)) {
    const field = pathLabel ? `${pathLabel}.${key}` : key;
    if (
      typeof child === "string" &&
      /(?:^url$|^href$|^src$|cover_image$|image(?:_url)?$|audio(?:_url)?$)/i.test(key)
    ) {
      ensureLocalUrl(source, field, child, sourceFile);
    } else {
      validateDeclaredLocalValues(child, source, sourceFile, field);
    }
  }
}

function chapterPagePath(workId, chapterId) {
  return chapterId === 0
    ? join(rootDirectory, "histoire", workId, "index.html")
    : join(rootDirectory, "histoire", workId, String(chapterId), "index.html");
}

function validateHistoireIndex() {
  const source = "json/histoire.json";
  const stories = readJson(source);
  if (!Array.isArray(stories)) {
    error(source, "顶层必须是作品数组。");
    return;
  }

  const seenIds = new Map();
  stories.forEach((story, index) => {
    const itemSource = `${source}[${index}]`;
    if (!story || typeof story !== "object") {
      error(itemSource, "作品条目必须是对象。");
      return;
    }
    if (typeof story.id !== "string" || !story.id.trim()) {
      error(itemSource, "缺少非空作品 id。");
    } else {
      if (!/^H[A-Z]+$/.test(story.id)) {
        error(itemSource, `作品 id 不符合基础格式 H+大写字母：${story.id}`);
      }
      if (seenIds.has(story.id)) {
        error(itemSource, `重复作品 id “${story.id}”；首次出现于 ${source}[${seenIds.get(story.id)}]。`);
      } else {
        seenIds.set(story.id, index);
      }
    }
    if (typeof story.url !== "string" || !story.url) {
      error(itemSource, "缺少作品 url。");
    } else {
      ensureLocalUrl(itemSource, "url", story.url, join(rootDirectory, source));
      const match = story.url.match(/^\/histoire\/([^/?#]+)\/?$/);
      if (match && story.id && match[1] !== story.id) {
        error(itemSource, `作品 id “${story.id}” 与 URL 目录 “${match[1]}” 不一致。`);
      }
    }
    validateDeclaredLocalValues(story, itemSource, join(rootDirectory, source));
  });
  ok(`${source}：检查了 ${stories.length} 个作品条目。`);
}

function validateChapterJsonFiles() {
  const directory = join(rootDirectory, "json", "histoire");
  const files = readdirSync(directory)
    .filter((name) => name.endsWith(".json"))
    .sort();

  for (const name of files) {
    const relativeFile = `json/histoire/${name}`;
    const workId = name.slice(0, -".json".length);
    const data = readJson(relativeFile);
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      error(relativeFile, "章节 JSON 顶层必须是包含 chapters 的对象。");
      continue;
    }
    if (!Array.isArray(data.chapters)) {
      error(relativeFile, "chapters 必须是数组。");
      continue;
    }

    const chapterIds = new Map();
    data.chapters.forEach((chapter, index) => {
      const itemSource = `${relativeFile}.chapters[${index}]`;
      const id = chapter?.id;
      if (!Number.isInteger(id) || id < 0) {
        error(itemSource, `章节 id 必须是大于等于 0 的整数，当前为：${String(id)}`);
        return;
      }
      if (chapterIds.has(id)) {
        error(itemSource, `重复章节 id ${id}；首次出现于 chapters[${chapterIds.get(id)}]。`);
      } else {
        chapterIds.set(id, index);
      }
      const pagePath = chapterPagePath(workId, id);
      if (!existsSync(pagePath)) {
        error(itemSource, `章节页面不存在：${displayPath(pagePath)}`);
      } else {
        const pageText = readFileSync(pagePath, "utf8");
        if (!pageText.includes('/js/common-his.js')) {
          error(itemSource, `常规章节页缺少 common-his.js：${displayPath(pagePath)}`);
        }
        if (!pageText.includes('id="chapter-nav-root"')) {
          error(itemSource, `常规章节页缺少章节导航容器：${displayPath(pagePath)}`);
        }
      }
    });

    const ids = [...chapterIds.keys()].sort((left, right) => left - right);
    if (!chapterIds.has(0)) {
      error(relativeFile, "常规章节结构缺少 id 为 0 的作品首页。");
    }
    if (ids.length > 0) {
      const largestId = ids.at(-1);
      for (let expected = 0; expected <= largestId; expected += 1) {
        if (!chapterIds.has(expected)) {
          error(relativeFile, `章节 id 缺号：缺少 ${expected}；上一章/下一章依赖连续数字。`);
        }
      }
      data.chapters.forEach((chapter, index) => {
        if (chapter?.id !== index) {
          error(
            `${relativeFile}.chapters[${index}]`,
            `JSON 顺序异常：当前位置应为 id ${index}，实际为 ${String(chapter?.id)}。`,
          );
        }
      });
    }
    validateDeclaredLocalValues(data, relativeFile, join(rootDirectory, relativeFile));
  }
  ok(`json/histoire/*.json：检查了 ${files.length} 个常规作品章节目录。`);
}

function validateListJson(relativeFile) {
  const data = readJson(relativeFile);
  if (data === null) return;
  validateDeclaredLocalValues(data, relativeFile, join(rootDirectory, relativeFile));
  const count = Array.isArray(data) ? data.length : 1;
  ok(`${relativeFile}：检查了 ${count} 个列表条目中的本地 URL 和资源。`);
}

function extractHtmlUrls(html) {
  const urls = [];
  for (const match of html.matchAll(assetAttributePattern)) {
    urls.push(match[2]);
  }
  for (const match of html.matchAll(srcsetAttributePattern)) {
    for (const candidate of match[2].split(",")) {
      const url = candidate.trim().split(/\s+/, 1)[0];
      if (url) urls.push(url);
    }
  }
  return urls;
}

function validateHtmlResources() {
  const htmlFiles = listFiles(rootDirectory, (file) => file.endsWith(".html"));
  for (const file of htmlFiles) {
    const source = displayPath(file);
    const html = readFileSync(file, "utf8");
    for (const rawUrl of extractHtmlUrls(html)) {
      ensureLocalUrl(source, "HTML 引用", rawUrl, file);
    }
  }
  ok(`HTML 资源引用：检查了 ${htmlFiles.length} 个 HTML 文件。`);
}

function validateInteractiveBranches() {
  const interactiveDirectory = join(rootDirectory, "histoire", "HHXLOYDCS");
  if (!existsSync(interactiveDirectory)) {
    warning("histoire/HHXLOYDCS", "互动作品目录不存在，跳过分支检查。");
    return;
  }
  const files = listFiles(interactiveDirectory, (file) => file.endsWith(".html"));
  for (const file of files) {
    const source = displayPath(file);
    const html = readFileSync(file, "utf8");
    for (const rawUrl of extractHtmlUrls(html)) {
      const path = cleanUrlPath(rawUrl);
      if (path && path.startsWith("/histoire/HHXLOYDCS/")) {
        ensureLocalUrl(source, "互动分支目标", rawUrl, file);
      }
    }
  }
  ok(`互动作品 HHXLOYDCS：检查了 ${files.length} 个分支页面的站内目标。`);
}

console.log("内容与结构只读校验开始（不会修改文件）。");
check("作品索引", validateHistoireIndex);
check("常规章节", validateChapterJsonFiles);
check("文章列表", () => validateListJson("json/article.json"));
check("首页列表", () => validateListJson("json/index.json"));
check("互动分支", validateInteractiveBranches);
check("HTML 资源", validateHtmlResources);

console.log(`\n检查完成：检查组 ${checks}，警告 ${warnings}，错误 ${errors}。`);
if (errors > 0) {
  console.error("校验失败：请人工检查上面的 ERROR；工具不会自动修改任何文件。");
  process.exitCode = 1;
} else {
  console.log("校验通过：未发现错误。");
}
