/* tag.js — 标签目录（依赖 list.js） */
(function () {
  const SCAN_JSON_PATHS = ["/json/article.json", "/json/histoire.json"];
  const PAGE_SIZE = 6;

  function getCurrentTagSlug() {
    const match = (location.pathname || "/").match(/^\/tag\/([^/]+)/);
    return match ? match[1] : null;
  }

  function filterEntriesByTag(entries, tagSlugs, tagSlug) {
    const tagName = [...tagSlugs].find(([, slug]) => slug === tagSlug)?.[0];
    return tagName
      ? entries.filter((entry) => Array.isArray(entry.tags) && entry.tags.includes(tagName))
      : [];
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (!window.CoreList?.mountPagedList) {
      console.error("[tag] CoreList 未加载。");
      return;
    }

    const tagSlug = getCurrentTagSlug();
    const mountEl = document.querySelector("#mt-list");
    if (!tagSlug || !mountEl) return;

    window.CoreList.mountPagedList(SCAN_JSON_PATHS, mountEl, {
      pageSize: PAGE_SIZE,
      emptyMessage: "未找到包含此标签的内容。",
      filterEntries: (entries, tagSlugs) =>
        filterEntriesByTag(entries, tagSlugs, tagSlug),
    });
  });
})();
