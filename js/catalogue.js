/* cqtqlogue.js
   板块目录显示系统 — 依赖 list.js
*/

(function () {
  /***** ========== 配置区========== *****/

  const ROUTE_TO_DB = {
    "/article": "/json/article.json",
    "/histoire": "/json/histoire.json",
  };
  const SECTION_DATABASES = {
    article: "/json/article.json",
    histoire: "/json/histoire.json",
  };
  const HOME_INDEX_PATH = "/json/index.json";

  const mountSelector = "#mt-list";
  const pageSize = 6; // 每页显示条目数

  /***** ========== 配置区结束 ========== *****/

  function debugLog(...args) {
    if (typeof console !== "undefined") console.log("[list]", ...args);
  }

  function getPathnameNormalized() {
    let p = location.pathname || "/";
    if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
    return p;
  }

  function findDbForPath(pathname) {
    const keys = Object.keys(ROUTE_TO_DB).sort((a, b) => b.length - a.length);
    for (const key of keys) {
      let kk = key;
      if (kk.length > 1 && kk.endsWith("/")) kk = kk.slice(0, -1);
      if (pathname === kk || pathname.startsWith(kk + "/")) {
        return ROUTE_TO_DB[key];
      }
    }
    return null;
  }

  function updateCatalogueMessage({ isLast }) {
    const message = document.querySelector("[data-catalogue-page-message]");
    if (message) message.textContent = isLast ? "没有更多了 QAQ" : "用右侧的按钮翻页哦~";
  }

  function mountHomeList(mountEl) {
    Promise.all([
      window.CoreList._fetchJsonArray(HOME_INDEX_PATH),
      window.CoreList._loadTagMetadata(),
    ])
      .then(([references, tagSlugs]) => {
        const sections = [
          ...new Set(
            references
              .map(({ section }) => section)
              .filter((section) => SECTION_DATABASES[section])
          ),
        ];
        return Promise.all(
          sections.map((section) =>
            window.CoreList._fetchJsonArray(SECTION_DATABASES[section]).then((entries) => [section, entries])
          )
        ).then((databases) => ({ references, tagSlugs, databases }));
      })
      .then(({ references, tagSlugs, databases }) => {
        const entriesBySection = new Map(
          databases.map(([section, entries]) => [
            section,
            new Map(entries.map((entry) => [entry.id, entry])),
          ])
        );
        const entries = references
          .map(({ section, id }) => entriesBySection.get(section)?.get(id))
          .filter(Boolean);

        mountEl.replaceChildren();
        const container = document.createElement("div");
        container.className = "mt-container";
        entries.forEach((entry, cardIndex) =>
          container.appendChild(window.CoreList._createTile(entry, { cardIndex, tagSlugs }))
        );
        mountEl.appendChild(container);
      })
      .catch((error) => console.error("[list] 首页推荐加载失败：", error));
  }

  // 启动
  document.addEventListener("DOMContentLoaded", () => {
    if (!window.CoreList || typeof window.CoreList.mountList !== "function") {
      console.error(
        "[list] CoreList 未加载。请先引入 list.js，然后再引入 catalogue.js。"
      );
      return;
    }

    const pathname = getPathnameNormalized();

    const mountEl = document.querySelector(mountSelector);

    // 优先检查挂载元素上是否指定了 data-json
    if (mountEl && mountEl.dataset && mountEl.dataset.json) {
      const dbPath = mountEl.dataset.json;
      window.CoreList.mountList(dbPath, mountEl, {
        pageSize,
      });
      return;
    }

    if (pathname === "/") {
      mountHomeList(mountEl);
      return;
    }

    const dbPath = findDbForPath(pathname);
    if (!dbPath) {
      debugLog(
        `未匹配到数据库路径（pathname="${pathname}"）。请在 ROUTE_TO_DB 中配置映射或在挂载元素上添加 data-json 属性。`
      );
      return;
    }

    if (!mountEl) {
      debugLog(
        `挂载元素 "${mountSelector}" 未找到，请在页面中添加 <div id="mt-list"></div> 或修改 mountSelector 配置。`
      );
      return;
    }
    if (pathname === "/histoire" || pathname === "/article") {
      window.CoreList.mountPagedList(dbPath, mountEl, {
        pageSize,
        onPageChange: updateCatalogueMessage,
      });
      return;
    }

    //希望我看不见那些报错
    window.CoreList.mountList(dbPath, mountEl, { pageSize });
  });
})();
