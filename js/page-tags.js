/* page-tags.js — 正文页分类标签与章节作品入口 */
(function () {
  if (window.__PAGE_TAGS_INITIALIZED) return;
  window.__PAGE_TAGS_INITIALIZED = true;

  function getPageContext() {
    const segments = location.pathname.split("/").filter(Boolean);
    if (segments[0] === "histoire" && segments[1]) {
      return {
        type: segments.length === 2 ? "story" : "chapter",
        id: segments[1],
      };
    }
    if (segments[0] === "article" && segments.length === 2) {
      return { type: "article", id: segments[1] };
    }
    return null;
  }

  function getHeading() {
    return (
      document.querySelector("main h1.shaking-text") ||
      document.querySelector("h1.shaking-text")
    );
  }

  function createContainer(kind) {
    const container = document.createElement("span");
    container.className = `tag-container tag-container--${kind}`;
    container.setAttribute("role", "group");
    container.setAttribute(
      "aria-label",
      kind === "parent" ? "返回所属作品" : "文章标签"
    );
    return container;
  }

  function appendTag(container, text, href, kind) {
    const tag = document.createElement("a");
    tag.className = `page-tag page-tag--${kind}`;
    tag.href = href;
    tag.textContent = text;
    container.appendChild(tag);
  }

  async function loadJson(path) {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`无法读取 ${path}`);
    return response.json();
  }

  async function resolveStoryEntry(entries, id) {
    const directEntry = entries.find((item) => item && item.id === id);
    if (directEntry) return { entry: directEntry, title: directEntry.title };

    const pageTagData = await loadJson("/json/page-tags.json");
    const fallback = pageTagData?.histoire?.[id];
    if (fallback?.kind === "taxonomy-source") {
      const sourceEntry = entries.find(
        (item) => item && item.id === fallback.sourceId
      );
      return sourceEntry ? { entry: sourceEntry, title: sourceEntry.title } : null;
    }
    return fallback?.title ? { entry: null, title: fallback.title, fallback } : null;
  }

  async function renderTaxonomyTags(heading, context) {
    const databasePath =
      context.type === "story" ? "/json/histoire.json" : "/json/article.json";
    const [entries, tagRows] = await Promise.all([
      loadJson(databasePath),
      loadJson("/json/tag.json"),
    ]);
    let entry = entries.find((item) => item && item.id === context.id);
    if (!entry && context.type === "story") {
      const resolved = await resolveStoryEntry(entries, context.id);
      if (
        resolved?.fallback?.kind === "parent" &&
        resolved.fallback.label &&
        resolved.fallback.href
      ) {
        const container = createContainer("parent");
        appendTag(
          container,
          resolved.fallback.label,
          resolved.fallback.href,
          "parent"
        );
        heading.appendChild(container);
        return;
      }
      entry = resolved?.entry;
    }
    if (!entry || !Array.isArray(entry.tags)) return;

    const tagSlugs = new Map(
      tagRows
        .filter((item) => item && item.zh && item.fr)
        .map((item) => [item.zh, item.fr])
    );
    const container = createContainer("taxonomy");
    entry.tags.forEach((tagName) => {
      const slug = tagSlugs.get(tagName);
      if (!slug) return;
      appendTag(container, tagName, `/tag/${encodeURIComponent(slug)}/`, "taxonomy");
    });
    if (container.childElementCount) heading.appendChild(container);
  }

  async function renderParentLink(heading, id) {
    const entries = await loadJson("/json/histoire.json");
    const resolved = await resolveStoryEntry(entries, id);
    if (!resolved?.title) return;

    const container = createContainer("parent");
    appendTag(
      container,
      resolved.title,
      `/histoire/${encodeURIComponent(id)}/`,
      "parent"
    );
    heading.appendChild(container);
  }

  async function init() {
    const context = getPageContext();
    const heading = getHeading();
    if (!context || !heading || heading.querySelector(".tag-container")) return;

    if (context.type === "chapter") {
      try {
        await renderParentLink(heading, context.id);
      } catch (error) {
        console.error("[PageTags] 作品数据加载失败：", error);
      }
      return;
    }

    try {
      await renderTaxonomyTags(heading, context);
    } catch (error) {
      console.error("[PageTags] 标签数据加载失败：", error);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
