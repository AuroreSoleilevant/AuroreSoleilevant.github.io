// chapter-nav.js
(function () {
  const ROOT_ID = "chapter-nav-root";
  const CONTAINER_CLASS = "chapter-nav";
  const BTN_CLASS = "nav-btn";
  const VISIBLE_CLASS = "visible";

  // 占位链接（先用占位，之后再由你接入实际逻辑）
  const PLACEHOLDER_PREV = "#prev"; // 占位链接
  const PLACEHOLDER_NEXT = "#next"; // 占位链接

  // 创建 DOM 并挂载
  // 替换或覆盖 chapter-nav.js 中的 createNav() 实现（最小改动）
  function createNav() {
    const ROOT_ID = "chapter-nav-root";
    const root = document.getElementById(ROOT_ID);
    if (!root) {
      console.warn(
        "[chapter-nav] root not found — creating at document.body (fallback)"
      );
    }

    // 避免重复
    const host = root || document.body;
    if (host._chapterNavCreated) return host._chapterNav;

    // 确保 host 能做为定位上下文（若 position: static，则改为 relative）
    try {
      const cs = getComputedStyle(host);
      if (cs.position === "static") host.style.position = "relative";
    } catch (e) {
      // ignore
    }

    // 容器（绝对定位，相对于 host）
    const container = document.createElement("div");
    container.className = "chapter-nav";
    container.setAttribute("role", "navigation");
    container.setAttribute("aria-label", "章节导航");

    // 上一章（文本）
    const prev = document.createElement("a");
    prev.className = "nav-btn prev";
    prev.href = "#prev"; // 占位，可后续改
    prev.setAttribute("aria-label", "上一章");
    prev.title = "上一章";
    prev.textContent = "上一章";

    // 目录（打开侧栏）
    const toc = document.createElement("button");
    toc.className = "nav-btn toc";
    toc.type = "button";
    toc.setAttribute("aria-label", "章节目录");
    toc.title = "章节目录";
    toc.textContent = "章节目录";

    // 下一章（文本）
    const next = document.createElement("a");
    next.className = "nav-btn next";
    next.href = "#next"; // 占位
    next.setAttribute("aria-label", "下一章");
    next.title = "下一章";
    next.textContent = "下一章";

    // 点击占位行为（可替换）
    prev.addEventListener("click", (e) => {
      e.preventDefault();
      console.log("prev (placeholder)");
    });
    next.addEventListener("click", (e) => {
      e.preventDefault();
      console.log("next (placeholder)");
    });

    // 目录按钮复用已有侧栏开关
    toc.addEventListener("click", (e) => {
      e.preventDefault();
      try {
        if (typeof openSidebar === "function") openSidebar();
        else {
          const t = document.getElementById("chapter-toggle");
          if (t) t.click();
        }
      } catch (err) {
        console.warn("chapter-nav: open sidebar failed", err);
      }
    });

    // 组装并插入 host（优先插入 root）
    container.appendChild(prev);
    container.appendChild(toc);
    container.appendChild(next);

    host.appendChild(container);

    // 暴露引用
    host._chapterNavCreated = true;
    host._chapterNav = { container, prev, toc, next };

    return host._chapterNav;
  }

  // 简单初始化：DOM ready 时创建（defer 脚本也可以）
  function init() {
    createNav();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
