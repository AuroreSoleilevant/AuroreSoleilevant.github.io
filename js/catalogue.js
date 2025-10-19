/* cqtqlogue.js
   板块目录显示系统 — 依赖 list.js
*/

(function () {
  /***** ========== 配置区========== *****/

  const ROUTE_TO_DB = {
    "/article": "/json/article.json",
    "/histoire": "/json/histoire.json",
  };

  const mountSelector = "#mt-list";
  const pageSize = 6; // 每页显示条目数
  const autoFormatDisplay = true;

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

  // 启动
  document.addEventListener("DOMContentLoaded", () => {
    if (!window.CoreList || typeof window.CoreList.mountList !== "function") {
      console.error(
        "[list] CoreList 未加载。请先引入 list.js，然后再引入 catalogue.js。"
      );
      return;
    }

    const pathname = getPathnameNormalized();

    // 优先检查挂载元素上是否指定了 data-json
    const explicitMount = document.querySelector(mountSelector);
    if (explicitMount && explicitMount.dataset && explicitMount.dataset.json) {
      const dbPath = explicitMount.dataset.json;
      window.CoreList.mountList(dbPath, explicitMount, {
        pageSize,
        autoFormatDisplay,
      });
      return;
    }

    const dbPath = findDbForPath(pathname);
    if (!dbPath) {
      debugLog(
        `未匹配到数据库路径（pathname="${pathname}"）。请在 ROUTE_TO_DB 中配置映射或在挂载元素上添加 data-json 属性。`
      );
      return;
    }

    const mountEl = document.querySelector(mountSelector);
    if (!mountEl) {
      debugLog(
        `挂载元素 "${mountSelector}" 未找到，请在页面中添加 <div id="mt-list"></div> 或修改 mountSelector 配置。`
      );
      return;
    }
    //希望我看不见那些报错
    window.CoreList.mountList(dbPath, mountEl, { pageSize, autoFormatDisplay });
  });
})();
