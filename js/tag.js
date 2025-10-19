/* tag.js
   分类页面的磁贴系统 — 依赖 list.js
   用于在 /tag/xxx 页面显示特定标签的所有内容，别用错了
*/

(function () {
  /***** ========== 配置区 ========== *****/

  // 要扫描的 JSON 文件路径数组
  const SCAN_JSON_PATHS = [
    "/json/article.json",
    "/json/histoire.json",
    // 以后的json就扔这里吧
  ];

  const mountSelector = "#mt-list";
  const pageSize = 6; // 每页显示条目数
  const autoFormatDisplay = true;

  /***** ========== 配置区结束 ========== *****/

  function debugLog(...args) {
    if (typeof console !== "undefined") console.log("[tag]", ...args);
  }

  // 从 URL 路径中提取标签 slug
  function getCurrentTagSlug() {
    const pathname = location.pathname || "/";
    const tagMatch = pathname.match(/^\/tag\/([^\/]+)/);
    return tagMatch ? tagMatch[1] : null;
  }

  // 过滤出包含指定标签 slug 的条目
  function filterEntriesByTagSlug(entries, tagSlug) {
    if (!tagSlug || !entries || !Array.isArray(entries)) return [];

    return entries.filter((entry) => {
      if (!entry.tags || !Array.isArray(entry.tags)) return false;

      return entry.tags.some((tag) => tag && tag.slug === tagSlug);
    });
  }

  // 复制 list.js 中的 ensureContainer 函数
  function ensureContainer(mountEl) {
    if (mountEl.classList && mountEl.classList.contains("mt-container"))
      return mountEl;
    const existing = mountEl.querySelector(".mt-container");
    if (existing) return existing;
    const cont = document.createElement("div");
    cont.className = "mt-container";
    mountEl.appendChild(cont);
    return cont;
  }

  // 复制 list.js 中的分页检测逻辑
  function detectPageFromLocation() {
    const q = new URLSearchParams(location.search).get("page");
    if (q && !Number.isNaN(Number(q)) && Number(q) >= 1)
      return Math.max(1, Math.floor(Number(q)));
    const pathname = (location.pathname || "/").replace(/\/+$/, "");
    const parts = pathname.split("/");
    const last = parts[parts.length - 1];
    const num = Number(last);
    if (!Number.isNaN(num) && Number.isInteger(num) && num >= 1) return num;
    return 1;
  }

  // 启动
  document.addEventListener("DOMContentLoaded", () => {
    if (!window.CoreList || typeof window.CoreList.mountList !== "function") {
      console.error(
        "[tag] CoreList 未加载。请先引入 list.js，然后再引入 tag.js。"
      );
      return;
    }

    const currentTagSlug = getCurrentTagSlug();
    if (!currentTagSlug) {
      debugLog("未检测到标签 slug，当前路径可能不是标签页面");
      return;
    }

    const mountEl = document.querySelector(mountSelector);
    if (!mountEl) {
      debugLog(
        `挂载元素 "${mountSelector}" 未找到，请在页面中添加 <div id="mt-list"></div> 或修改 mountSelector 配置。`
      );
      return;
    }

    debugLog(`正在加载标签: ${currentTagSlug}`);

    // 加载所有 JSON 文件
    window.CoreList._loadDatabases(SCAN_JSON_PATHS)
      .then((allEntries) => {
        // 过滤出包含当前标签的条目
        const filteredEntries = filterEntriesByTagSlug(
          allEntries,
          currentTagSlug
        );

        debugLog(
          `找到 ${filteredEntries.length} 个包含标签 "${currentTagSlug}" 的条目`
        );

        if (filteredEntries.length === 0) {
          mountEl.innerHTML = `<p>未找到包含此标签的内容。</p>`;
          return;
        }

        // 清空挂载元素
        mountEl.innerHTML = "";

        // 使用独立的 ensureContainer 函数
        const container = ensureContainer(mountEl);
        container.innerHTML = "";

        // 排序
        const sorted = window.CoreList._sortEntries(filteredEntries);

        // 自动检测页码
        const page = detectPageFromLocation();

        // 分页
        const pageSlice = window.CoreList._paginate(sorted, page, pageSize);

        // 创建磁贴
        pageSlice.forEach((entry) => {
          try {
            const tile = window.CoreList._createTile(entry, {
              autoFormatDisplay: autoFormatDisplay,
            });
            container.appendChild(tile);
          } catch (err) {
            console.error("[tag] createTile error:", err, entry);
          }
        });
      })
      .catch((err) => {
        console.error("[tag] 加载数据错误:", err);
        mountEl.innerHTML = `<p>加载标签内容时出错。</p>`;
      });
  });
})();
