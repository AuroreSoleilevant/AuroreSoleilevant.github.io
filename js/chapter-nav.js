// chapter-nav.js — 自动根据 URL + JSON 生成 上一章 / 目录 / 下一章 按钮
(function () {
  const ROOT_ID = "chapter-nav-root";
  const JSON_BASE = "/json/histoire/"; // JSON 存放目录
  let chaptersCache = {}; // 缓存 per workName

  // 解析 URL 得到 workName 与 currentId（若无 /n 则视为首页 = 0）
  function getWorkInfoFromURL() {
    const parts = window.location.pathname.split("/").filter(Boolean);
    const idx = parts.indexOf("histoire");
    if (idx === -1) return null;
    const workName = parts[idx + 1];
    if (!workName) return null;
    const maybeId = parts[idx + 2];
    const currentId = maybeId ? Number.parseInt(maybeId, 10) : 0;
    const finalId = maybeId
      ? Number.isFinite(currentId)
        ? currentId
        : null
      : 0;
    const basePath = `/histoire/${encodeURIComponent(workName)}`;
    return { workName, currentId: finalId, basePath };
  }

  // 读取 json（缓存）
  async function fetchChapters(workName) {
    if (!workName) return null;
    if (chaptersCache[workName]) return chaptersCache[workName];
    const path = JSON_BASE + encodeURIComponent(workName) + ".json";
    try {
      const resp = await fetch(path, { cache: "no-cache" });
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      const data = await resp.json();
      const list = Array.isArray(data)
        ? data
        : data && data.chapters
        ? data.chapters
        : [];
      const normalized = list.map((it) => ({
        id: Number(it.id),
        title: it.title || "",
      }));
      const idSet = new Set(normalized.map((it) => it.id));
      chaptersCache[workName] = { list: normalized, idSet };
      return chaptersCache[workName];
    } catch (err) {
      console.warn("chapter-nav: failed to load JSON", path, err);
      chaptersCache[workName] = { list: [], idSet: new Set() };
      return chaptersCache[workName];
    }
  }

  // 在 root上渲染按钮（会先清空已有容器）
  async function renderNav() {
    const info = getWorkInfoFromURL();
    const root = document.getElementById(ROOT_ID) || document.body;
    if (root._chapterNav && root._chapterNav.container) {
      try {
        root._chapterNav.container.remove();
      } catch (e) {}
      root._chapterNav = null;
    }

    const container = document.createElement("div");
    container.className = "chapter-nav";
    container.setAttribute("role", "navigation");
    container.setAttribute("aria-label", "章节导航");

    function makeLinkBtn(text, href, cls = "") {
      const a = document.createElement("a");
      a.className = "nav-btn " + cls;
      a.href = href;
      a.textContent = text;
      a.setAttribute("aria-label", text);
      return a;
    }
    function makeButton(text, cls = "") {
      const b = document.createElement("button");
      b.className = "nav-btn " + cls;
      b.type = "button";
      b.textContent = text;
      b.setAttribute("aria-label", text);
      return b;
    }

    if (!info) {
      root.appendChild(container);
      root._chapterNav = { container };
      return;
    }

    const ch = await fetchChapters(info.workName);
    const idSet = ch.idSet;
    const cur = info.currentId;

    if (cur !== null && cur !== 0) {
      const prevId = cur - 1;
      const prevHref =
        prevId === 0 ? info.basePath : `${info.basePath}/${prevId}`;
      const prevBtn = makeLinkBtn("上一章", prevHref, "prev");
      container.appendChild(prevBtn);
    }

    const tocBtn = makeButton("章节目录", "toc");
    tocBtn.addEventListener("click", (e) => {
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
    tocBtn.classList.add("toc");
    container.appendChild(tocBtn);

    let nextId = null;
    if (cur === 0) {
      if (ch.list && ch.list.length > 0) {
        const positives = ch.list
          .map((i) => i.id)
          .filter((id) => id > 0)
          .sort((a, b) => a - b);
        if (positives.length > 0) nextId = positives[0];
      }
    } else if (cur !== null) {
      if (idSet.has(cur + 1)) nextId = cur + 1;
    }

    if (nextId !== null && nextId !== undefined) {
      const nextHref = `${info.basePath}/${nextId}`;
      const nextBtn = makeLinkBtn("下一章", nextHref, "next");
      container.appendChild(nextBtn);
    }

    root.appendChild(container);
    root._chapterNav = { container };
  }

  function init() {
    renderNav();
    window.addEventListener("popstate", () => renderNav());
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
