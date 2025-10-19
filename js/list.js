/* list.js
   目录磁贴系统核心组件
   注释什么的以后再说吧
*/

(function () {
  function fetchJsonArray(path) {
    return fetch(path)
      .then((res) => {
        if (!res.ok) throw new Error(`fetch ${path} failed: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!Array.isArray(data)) {
          console.warn(`[CoreList] ${path} did not return an array.`);
          return [];
        }
        return data;
      })
      .catch((err) => {
        console.error(`[CoreList] error fetching ${path}:`, err);
        return [];
      });
  }

  function loadDatabases(paths) {
    if (!paths) return Promise.resolve([]);
    if (typeof paths === "string") {
      return fetchJsonArray(paths);
    }
    if (Array.isArray(paths)) {
      return Promise.all(paths.map((p) => fetchJsonArray(p))).then((arrays) =>
        arrays.flat()
      );
    }
    return Promise.resolve([]);
  }

  function formatDisplay(isoString) {
    if (!isoString) return "";
    const d = new Date(isoString);
    if (isNaN(d)) return isoString;
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  function createTile(entry, opts) {
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
    } = entry || {};

    const createdDisp =
      created_display ||
      (opts.autoFormatDisplay ? formatDisplay(created_at) : created_at || "");
    const updatedDisp =
      updated_display ||
      (opts.autoFormatDisplay ? formatDisplay(updated_at) : updated_at || "");

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
    (tags || []).forEach((t) => {
      const tagName = t && t.name ? t.name : "";
      const tagUrl = t && t.url ? t.url : "#";
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

  function sortEntries(entries) {
    return entries.sort((a, b) => {
      const ta = new Date((a && (a.updated_at || a.created_at)) || 0).getTime();
      const tb = new Date((b && (b.updated_at || b.created_at)) || 0).getTime();
      return tb - ta;
    });
  }

  function paginate(entries, page, pageSize) {
    const p = Math.max(1, Math.floor(Number(page) || 1));
    const start = (p - 1) * pageSize;
    return entries.slice(start, start + pageSize);
  }

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

  function mountList(dbPathOrArray, mountEl, options) {
    if (!mountEl) {
      console.warn("[CoreList] mountEl is required.");
      return;
    }
    const opts = Object.assign(
      { pageSize: 6, autoFormatDisplay: true, page: null },
      options || {}
    );

    loadDatabases(dbPathOrArray)
      .then((allData) => {
        const sorted = sortEntries(allData || []);
        const page =
          opts.page ||
          (function detectPageFromLocation() {
            const q = new URLSearchParams(location.search).get("page");
            if (q && !Number.isNaN(Number(q)) && Number(q) >= 1)
              return Math.max(1, Math.floor(Number(q)));
            const pathname = (location.pathname || "/").replace(/\/+$/, "");
            const parts = pathname.split("/");
            const last = parts[parts.length - 1];
            const num = Number(last);
            if (!Number.isNaN(num) && Number.isInteger(num) && num >= 1)
              return num;
            return 1;
          })();

        const pageSlice = paginate(sorted, page, opts.pageSize);

        mountEl.innerHTML = "";

        const container = ensureContainer(mountEl);
        container.innerHTML = "";

        pageSlice.forEach((entry) => {
          try {
            const tile = createTile(entry, {
              autoFormatDisplay: opts.autoFormatDisplay,
            });
            container.appendChild(tile);
          } catch (err) {
            console.error("[CoreList] createTile error:", err, entry);
          }
        });
      })
      .catch((err) => {
        console.error("[CoreList] mountList error:", err);
      });
  }

  window.CoreList = {
    mountList,
    _fetchJsonArray: fetchJsonArray,
    _loadDatabases: loadDatabases,
    _createTile: createTile,
    _formatDisplay: formatDisplay,
    _sortEntries: sortEntries,
    _paginate: paginate,
  };
})();
