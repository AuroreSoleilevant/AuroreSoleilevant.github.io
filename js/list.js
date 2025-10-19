/* 列表识别js */

(function () {
  /***** ========== 配置区========== *****/

  // 路径映射：页面路径前缀 => 对应 JSON 数据文件（可以是相对路径或绝对地址）
  // 例如：当用户访问 /article 或 /article/2 时，会匹配到 '/article' 并加载 '/json/article.json'
  // 注意：按 key 长度优先匹配（更长的 key 会优先），支持简单前缀匹配。
  // 希望我下次还看的懂上面的东西
  const ROUTE_TO_DB = {
    "/article": "/json/article.json",
    "/histoire": "/json/histoire.json",
  };

  // 挂载点选择器（页面中用于注入磁贴的容器）
  // 在页面中添加： <div id="mt-list"></div>
  // 没事别改
  const mountSelector = "#mt-list";

  // 每页条目数
  const pageSize = 6;

  // 如果数据库中没有 display 字段，是否自动格式化 ISO 字符串用于显示（true/false）
  const autoFormatDisplay = true;

  /***** ========== 配置区结束 ========== *****/

  // ---- 工具函数 ----
  function debugLog(...args) {
    if (typeof console !== "undefined") console.log("[article-list]", ...args);
  }

  function getPathnameNormalized() {
    // 返回 pathname，去除末尾斜杠（但保留根 `/`）
    let p = location.pathname || "/";
    if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
    return p;
  }

  function findDbForPath(pathname) {
    // 找到 ROUTE_TO_DB 中与 pathname 前缀匹配的项，按 key 长度优先
    const keys = Object.keys(ROUTE_TO_DB).sort((a, b) => b.length - a.length);
    for (const key of keys) {
      // 规范化 key
      let kk = key;
      if (kk.length > 1 && kk.endsWith("/")) kk = kk.slice(0, -1);
      if (pathname === kk || pathname.startsWith(kk + "/")) {
        return ROUTE_TO_DB[key];
      }
    }
    return null;
  }

  function getCurrentPage() {
    // 解析当前页码： /article 或 /article/ -> 1 ; /article/2 -> 2
    // 另外，如果 ?page=N 存在也会作为后备
    const q = new URLSearchParams(location.search).get("page");
    if (q && !Number.isNaN(Number(q)) && Number(q) >= 1) {
      return Math.max(1, Math.floor(Number(q)));
    }

    const pathname = getPathnameNormalized();
    // 取最后一段，若为数字则为页码；否则为 1
    const parts = pathname.split("/");
    const last = parts[parts.length - 1];
    const num = Number(last);
    // 特殊情况：如果最后段是 route 本身（例如 /article），则返回 1
    // 我们只在 last 是数字时视为页码
    if (!Number.isNaN(num) && Number.isInteger(num) && num >= 1) return num;
    return 1;
  }

  function formatDisplay(isoString) {
    if (!isoString) return "";
    if (!autoFormatDisplay) return isoString;
    const d = new Date(isoString);
    if (isNaN(d)) return isoString;
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  // 创建单个磁贴 DOM（与现有 HTML 结构完全一致，唯一不同：tag 用 <a> 可点击）
  // 太小了点不到什么的随他去吧
  function createTile(entry) {
    const {
      id = "",
      url = "#",
      title = "",
      description = "",
      cover_image = null,
      cover_image_alt = "",
      created_at,
      updated_at,
      created_display,
      updated_display,
      word_count,
      color = "rgba(0,0,0,0.0)",
      tags = [],
    } = entry;

    const createdDisp = created_display || formatDisplay(created_at);
    const updatedDisp = updated_display || formatDisplay(updated_at);

    const a = document.createElement("a");
    a.className = "mt-tile";
    a.href = url;
    a.style.setProperty("--mt-color", color);

    if (cover_image) {
      const img = document.createElement("img");
      img.className = "mt-image";
      img.src = cover_image;
      img.alt = cover_image_alt || title || "";
      img.decoding = "async";
      img.loading = "lazy";
      a.appendChild(img);
    }

    const content = document.createElement("div");
    content.className = "mt-content";

    const h3 = document.createElement("h3");
    h3.className = "mt-title";
    h3.textContent = title;
    content.appendChild(h3);

    const pDesc = document.createElement("p");
    pDesc.className = "mt-description";
    pDesc.textContent = description;
    content.appendChild(pDesc);

    const pInfo = document.createElement("p");
    pInfo.className = "mt-description mt-info";
    const wordPart = typeof word_count === "number" ? `${word_count} 字` : "";
    const createdPart = createdDisp ? `${createdDisp} 发布` : "";
    const updatedPart = updatedDisp ? `${updatedDisp} 修改` : "";
    const parts = [wordPart, createdPart, updatedPart].filter(Boolean);
    pInfo.textContent = parts.join(" | ");
    content.appendChild(pInfo);

    const tagsDiv = document.createElement("div");
    tagsDiv.className = "mt-tags";

    tags.forEach((t) => {
      const tagName = t.name || "";
      const tagUrl = t.url || "#";
      const tagA = document.createElement("a");
      tagA.className = "mt-tag";
      tagA.href = tagUrl;
      tagA.textContent = tagName;
      tagsDiv.appendChild(tagA);
    });

    content.appendChild(tagsDiv);
    a.appendChild(content);

    return a;
  }

  // 注入逻辑：读取 JSON -> 排序 -> 分页 -> 注入 DOM
  function mountList(dbPath, mountEl) {
    if (!dbPath) {
      console.warn("[article-list] 未找到 dbPath，跳过。");
      return;
    }
    if (!mountEl) {
      console.warn("[article-list] 未找到挂载元素，跳过。");
      return;
    }

    fetch(dbPath)
      .then((res) => {
        if (!res.ok) throw new Error(`fetch ${dbPath} failed: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!Array.isArray(data)) {
          console.warn("[article-list] 数据文件顶层不是数组，无法处理。");
          return;
        }

        // 排序
        data.sort((a, b) => {
          const ta = new Date(a.updated_at || a.created_at || 0).getTime();
          const tb = new Date(b.updated_at || b.created_at || 0).getTime();
          return tb - ta;
        });

        const page = getCurrentPage();
        const startIndex = (page - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const slice = data.slice(startIndex, endIndex);

        // 清空挂载点（我们将创建或重用一个 .mt-container 放入此挂载点）
        mountEl.innerHTML = "";

        // 如果挂载点本身已经就是 .mt-container，直接用它；否则查找或新建一个 .mt-container
        let container;
        if (mountEl.classList && mountEl.classList.contains("mt-container")) {
          container = mountEl;
        } else {
          container = document.createElement("div");
          container.className = "mt-container";
        }

        // 添加 tile（每个 tile 是一个 <a class="mt-tile">）
        slice.forEach((entry) => {
          try {
            const tile = createTile(entry);
            container.appendChild(tile);
          } catch (err) {
            console.error("[article-list] 生成磁贴时出错：", err, entry);
          }
        });

        // 把 container（如果是新建的）挂回页面
        if (container !== mountEl) {
          mountEl.appendChild(container);
        }
      })
      .catch((err) => {
        console.error("[article-list] 加载数据库出错：", err);
      });
  }

  // 启动
  document.addEventListener("DOMContentLoaded", () => {
    const pathname = getPathnameNormalized();

    // 1) 先查找显式挂载点（如果该元素带 data-json 属性，则优先使用该 json 路径）
    const explicitMount = document.querySelector(mountSelector);
    if (explicitMount && explicitMount.dataset && explicitMount.dataset.json) {
      // 如果 mount 元素上写了 data-json="/path/to/db.json"，使用它（支持 per-page 覆盖）
      mountList(explicitMount.dataset.json, explicitMount);
      return;
    }

    // 2) 否则，通过 ROUTE_TO_DB 映射查找
    const dbPath = findDbForPath(pathname);
    if (!dbPath) {
      debugLog(
        `未匹配到数据库路径（pathname="${pathname}"）。请在 ROUTE_TO_DB 中配置映射或在挂载元素上添加 data-json 属性。`
      );
      return;
    }

    // 找到挂载点元素
    const mountEl = document.querySelector(mountSelector);
    if (!mountEl) {
      debugLog(
        `挂载元素 "${mountSelector}" 未找到，请在页面中添加 <div id="mt-list"></div> 或修改 mountSelector 配置。`
      );
      return;
    }

    mountList(dbPath, mountEl);
  });
})();
