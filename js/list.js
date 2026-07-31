/* list.js
   目录磁贴系统核心组件
   注释什么的以后再说吧
*/

(function () {
  let tagMetadataPromise = null;

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
    const isoDate = String(isoString).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoDate) return `${isoDate[3]}/${isoDate[2]}/${isoDate[1]}`;
    const d = new Date(isoString);
    if (isNaN(d)) return isoString;
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  function loadTagMetadata() {
    if (!tagMetadataPromise) {
      const request =
        window.__tagMetadataRequest ||
        (window.__tagMetadataRequest = fetch("/json/tag.json", {
          cache: "force-cache",
        }).then((res) => {
          if (!res.ok) throw new Error(`fetch tag metadata failed: ${res.status}`);
          return res.json();
        }));
      tagMetadataPromise = request
        .then((data) =>
          new Map(
            data
              .filter(({ fr, zh }) => typeof fr === "string" && typeof zh === "string")
              .map(({ fr, zh }) => [zh, fr])
          )
        )
        .catch((err) => {
          console.error("[CoreList] tag metadata error:", err);
          return new Map();
        });
    }
    return tagMetadataPromise;
  }

  function cardImageSource(coverImage) {
    const imagePrefix = "/images/";
    if (
      !coverImage ||
      !coverImage.startsWith(imagePrefix) ||
      coverImage.includes("/cards/")
    ) {
      return { src: coverImage, fallback: "" };
    }
    const relative = coverImage.slice(imagePrefix.length);
    const extension = relative.lastIndexOf(".");
    const slash = relative.indexOf("/");
    if (slash < 1 || extension <= slash + 1) {
      return { src: coverImage, fallback: "" };
    }
    const section = relative.slice(0, slash);
    const filename = relative.slice(slash + 1, extension);
    return {
      src: `${imagePrefix}${section}/cards/${filename}.webp`,
      fallback: coverImage,
    };
  }

  function createTile(entry, opts) {
    const {
      url = "#",
      title = "",
      description = "",
      cover_image = null,
      created_at,
      updated_at,
      word_count,
      color = "rgba(0,0,0,0.0)",
      tags = [],
    } = entry || {};

    const createdDisp = formatDisplay(created_at);
    const updatedDisp = formatDisplay(updated_at);

    const a = document.createElement("a");
    a.className = "mt-tile";
    a.href = url;
    a.style.setProperty("--mt-color", color);

    if (cover_image) {
      const img = document.createElement("img");
      const cardImage = cardImageSource(cover_image);
      img.className = "mt-image";
      img.alt = title;
      img.decoding = "async";
      img.loading = opts.cardIndex < 2 ? "eager" : "lazy";
      if (opts.cardIndex < 2) img.fetchPriority = "high";
      if (cardImage.fallback) img.dataset.cardFallbackSrc = cardImage.fallback;
      img.src = cardImage.src;
      window.SpicaImageLifecycle?.handleImage(img);
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
    (tags || []).forEach((tagName) => {
      if (typeof tagName !== "string") return;
      const tagSlug = opts.tagSlugs?.get(tagName);
      const tagEl = document.createElement(tagSlug ? "a" : "span");
      tagEl.className = "mt-tag";
      if (tagSlug) tagEl.href = `/tag/${tagSlug}/`;
      tagEl.textContent = tagName;
      tagsDiv.appendChild(tagEl);
    });
    content.appendChild(tagsDiv);

    a.appendChild(content);
    return a;
  }

  function sortEntries(entries) {
    return entries.sort((a, b) => {
      const updatedA = new Date((a && a.updated_at) || 0).getTime();
      const updatedB = new Date((b && b.updated_at) || 0).getTime();
      if (updatedA !== updatedB) return updatedB - updatedA;

      const createdA = new Date((a && a.created_at) || 0).getTime();
      const createdB = new Date((b && b.created_at) || 0).getTime();
      return createdB - createdA;
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

    Promise.all([loadDatabases(dbPathOrArray), loadTagMetadata()])
      .then(([allData, tagSlugs]) => {
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

        pageSlice.forEach((entry, cardIndex) => {
          try {
            const tile = createTile(entry, {
              cardIndex,
              tagSlugs,
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

  function mountPagedList(dbPath, mountEl, options) {
    if (!mountEl) {
      console.warn("[CoreList] mountEl is required.");
      return;
    }

    const opts = Object.assign(
      { pageSize: 6, onPageChange: null, filterEntries: null, emptyMessage: "" },
      options || {}
    );
    let page = 1;
    let totalPages = 1;
    let sortedEntries = [];
    let tagSlugs = new Map();
    let container = null;

    function pageFromLocation() {
      const value = new URLSearchParams(location.search).get("page");
      return /^\d+$/.test(value || "") ? Number(value) : 1;
    }

    function updatePageUrl(nextPage, replace) {
      const url = new URL(location.href);
      if (nextPage <= 1) url.searchParams.delete("page");
      else url.searchParams.set("page", String(nextPage));
      history[replace ? "replaceState" : "pushState"](
        { cataloguePage: nextPage },
        "",
        `${url.pathname}${url.search}${url.hash}`
      );
    }

    function render(nextPage, { updateUrl = false, replaceUrl = false } = {}) {
      page = Math.min(totalPages, Math.max(1, Math.floor(Number(nextPage) || 1)));
      if (updateUrl) updatePageUrl(page, replaceUrl);

      const pageSlice = paginate(sortedEntries, page, opts.pageSize);
      if (!container) {
        const detail = { page, totalPages, isLast: true, navigate };
        window.__cataloguePagination = detail;
        opts.onPageChange?.(detail);
        document.dispatchEvent(new CustomEvent("catalogue:pagination", { detail }));
        return;
      }
      const replaceCards = () => {
        container.replaceChildren();
        pageSlice.forEach((entry, cardIndex) => {
          try {
            container.appendChild(createTile(entry, { cardIndex, tagSlugs }));
          } catch (err) {
            console.error("[CoreList] createTile error:", err, entry);
          }
        });
        requestAnimationFrame(() => container.classList.remove("is-page-changing"));
      };

      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (container.children.length && !reduceMotion) {
        container.classList.add("is-page-changing");
        window.setTimeout(replaceCards, 250);
      } else {
        replaceCards();
      }

      const detail = { page, totalPages, isLast: page === totalPages, navigate };
      window.__cataloguePagination = detail;
      opts.onPageChange?.(detail);
      document.dispatchEvent(new CustomEvent("catalogue:pagination", { detail }));
    }

    function navigate(nextPage) {
      render(nextPage, { updateUrl: true });
    }

    Promise.all([loadDatabases(dbPath), loadTagMetadata()])
      .then(([allData, nextTagSlugs]) => {
        tagSlugs = nextTagSlugs;
        const entries = opts.filterEntries
          ? opts.filterEntries(allData || [], tagSlugs)
          : allData || [];
        sortedEntries = sortEntries(entries);
        totalPages = Math.max(1, Math.ceil(sortedEntries.length / opts.pageSize));
        container = ensureContainer(mountEl);
        if (!sortedEntries.length && opts.emptyMessage) {
          mountEl.replaceChildren();
          const message = document.createElement("p");
          message.textContent = opts.emptyMessage;
          mountEl.appendChild(message);
          container = null;
        }
        render(pageFromLocation());
      })
      .catch((err) => console.error("[CoreList] mountPagedList error:", err));

    window.addEventListener("popstate", () => {
      if (container) render(pageFromLocation());
    });
  }

  window.CoreList = {
    mountList,
    mountPagedList,
    _fetchJsonArray: fetchJsonArray,
    _loadDatabases: loadDatabases,
    _loadTagMetadata: loadTagMetadata,
    _createTile: createTile,
    _formatDisplay: formatDisplay,
    _sortEntries: sortEntries,
    _paginate: paginate,
  };
})();
