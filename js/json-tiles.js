/* json-tiles.js — JSON 长条磁贴渲染与通用数组计数 */
(function () {
  "use strict";

  const requests = new Map();

  function loadArray(path) {
    if (!requests.has(path)) {
      requests.set(
        path,
        fetch(path, { cache: "force-cache" }).then((response) => {
          if (!response.ok) {
            throw new Error(`读取 ${path} 失败：${response.status}`);
          }
          return response.json();
        }).then((data) => {
          if (!Array.isArray(data)) {
            throw new Error(`${path} 的顶层必须是数组`);
          }
          return data;
        })
      );
    }
    return requests.get(path);
  }

  function handleImage(image) {
    if (window.SpicaImageLifecycle?.handleImage) {
      window.SpicaImageLifecycle.handleImage(image);
      return;
    }
    const ready = () => image.classList.add("is-image-ready", "loaded");
    const failed = () => image.classList.add("is-image-failed");
    if (image.complete) {
      if (image.naturalWidth) ready();
      else failed();
      return;
    }
    image.addEventListener("load", ready, { once: true, passive: true });
    image.addEventListener("error", failed, { once: true, passive: true });
  }

  function validateTile(entry, path, index) {
    const fields = ["color", "name", "code", "image", "url"];
    const missing = fields.filter(
      (field) => typeof entry?.[field] !== "string" || !entry[field].trim()
    );
    if (missing.length) {
      throw new Error(`${path} 第 ${index + 1} 条缺少有效字段：${missing.join(", ")}`);
    }
  }

  function createTile(entry) {
    const link = document.createElement("a");
    link.className = "tile tile-strip-new";
    link.href = entry.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.style.setProperty("--tile-color", entry.color);

    const image = document.createElement("img");
    image.className = "tile-thumb";
    image.src = entry.image;
    image.alt = entry.name;
    image.title = entry.name;
    image.loading = "lazy";
    image.decoding = "async";
    link.appendChild(image);

    const content = document.createElement("div");
    content.className = "tile-content";
    const heading = document.createElement("h1");
    const fullTitle = document.createElement("span");
    fullTitle.className = "full-title";
    fullTitle.textContent = `${entry.code} ———— ${entry.name}`;
    const shortTitle = document.createElement("span");
    shortTitle.className = "short-title";
    shortTitle.textContent = entry.name;
    heading.append(fullTitle, shortTitle);
    content.appendChild(heading);
    link.appendChild(content);
    handleImage(image);
    return link;
  }

  async function renderTiles(mount) {
    const path = mount.dataset.jsonTiles;
    try {
      const entries = await loadArray(path);
      const fragment = document.createDocumentFragment();
      entries.forEach((entry, index) => {
        validateTile(entry, path, index);
        if (index) fragment.appendChild(document.createElement("br"));
        const row = document.createElement("div");
        row.className = "tiles";
        row.appendChild(createTile(entry));
        fragment.appendChild(row);
      });
      mount.replaceChildren(fragment);
    } catch (error) {
      console.error("[JsonTiles] 磁贴加载失败：", error);
      const message = document.createElement("p");
      message.className = "text-center";
      message.textContent = "列表加载失败，请稍后重试。";
      mount.replaceChildren(message);
    }
  }

  async function renderCount(element) {
    const path = element.dataset.jsonCount;
    try {
      const entries = await loadArray(path);
      element.textContent = String(entries.length);
    } catch (error) {
      console.error("[JsonTiles] 数量加载失败：", error);
      element.textContent = "?";
    }
  }

  function init() {
    document.querySelectorAll("[data-json-tiles]").forEach(renderTiles);
    document.querySelectorAll("[data-json-count]").forEach(renderCount);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
