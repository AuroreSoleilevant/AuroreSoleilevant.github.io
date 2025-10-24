/* 分页模块，自动插入至目录页 */
/* 扩展的时候记得改2个地方 */
(function () {
  const CONFIG = {
    maxPages: {
      histoire: 2, // 故事区最大页数
      article: 1, // 文章区最大页数
      // 分类页面配置 - 每个分类单独设置最大页数
      "tag/musique": 1, //1
      "tag/long": 1, //1
      "tag/fini": 2, //6
      "tag/MLP": 1, //4
      "tag/apaisant": 1, //3
      "tag/amour": 1, //4
      "tag/moyenne": 1, //2
      "tag/court": 1, //3
      "tag/comedie": 1, //1
      "tag/suspense": 1, //1
      "tag/epouvante": 1, //1
      // 1.在这里扩展未来可能的新区的最大页数
    },
  };

  const MAIN_CONTENT_SELECTOR = ".main-content"; // main 类名

  function getSegments() {
    const p = location.pathname.replace(/\/+$/, "");
    return p.split("/").filter(Boolean);
  }

  function getSectionAndPage() {
    const seg = getSegments();
    if (seg.length === 0) return { section: null, page: null };

    // 检查是否是标签页面 (/tag/xxx 或 /tag/xxx/页码)
    if (seg[0] === "tag" && seg.length >= 2) {
      const tagSlug = seg[1];
      const page = seg[2] && /^\d+$/.test(seg[2]) ? parseInt(seg[2], 10) : 1;
      return {
        section: `tag/${tagSlug}`, // 使用 "tag/标签名" 作为section标识
        page,
        tagSlug,
      };
    }

    const section = seg[0];
    if (
      section !== "histoire" &&
      section !== "article" &&
      section !== "musique" &&
      section !== "long" &&
      section !== "fini" &&
      section !== "MLP" &&
      section !== "apaisant" &&
      section !== "amour" &&
      section !== "moyenne" &&
      section !== "court" &&
      section !== "comedie" &&
      section !== "suspense" &&
      section !== "epouvante"
    )
      // 2.把新区的名字写进白名单
      return { section: null, page: null };
    const page = seg[1] && /^\d+$/.test(seg[1]) ? parseInt(seg[1], 10) : 1;
    return { section, page };
  }

  function buildUrl(section, page, tagSlug) {
    // 处理标签页面
    if (section.startsWith("tag/")) {
      if (page === 1) return `/tag/${tagSlug}`;
      return `/tag/${tagSlug}/${page}`;
    } else {
      // 处理普通页面
      if (page === 1) return `/${section}`;
      return `/${section}/${page}`;
    }
  }

  function createModuleDom() {
    const container = document.createElement("div");
    container.id = "pg2-paginator";
    container.className = "pg2-paginator";
    container.setAttribute("role", "navigation");
    container.setAttribute("aria-label", "页面翻页");
    container.innerHTML = `
      <button class="pg2-btn pg2-prev" aria-label="上一页" type="button"></button>
      <div class="pg2-current" aria-current="page">1</div>
      <button class="pg2-btn pg2-next" aria-label="下一页" type="button"></button>
      <div class="pg2-jump" aria-hidden="false">
        <input class="pg2-jump-input" type="text" inputmode="numeric" pattern="\\d*" placeholder="页码" aria-label="跳转页码输入" />
        <button class="pg2-jump-go" type="button" aria-label="前往">前往</button>
      </div>
    `;

    // 插入到 main 内容区域中
    const main = document.querySelector(MAIN_CONTENT_SELECTOR);
    if (main) {
      main.appendChild(container);
    } else {
      // 如果找不到 main，回退到 body 末尾
      console.warn("Main content area not found, falling back to body");
      document.body.appendChild(container);
    }
    return container;
  }

  function arrowSvg(direction = "left") {
    if (direction === "left") {
      return `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
        <path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`;
    } else {
      return `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
        <path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`;
    }
  }

  function init() {
    const result = getSectionAndPage();
    if (!result.section) return;

    const { section, page, tagSlug } = result;

    let module = document.getElementById("pg2-paginator");
    if (!module) module = createModuleDom();

    const prevBtn = module.querySelector(".pg2-prev");
    const nextBtn = module.querySelector(".pg2-next");
    const currentEl = module.querySelector(".pg2-current");
    const jumpWrap = module.querySelector(".pg2-jump");
    const jumpInput = module.querySelector(".pg2-jump-input");
    let goBtn = module.querySelector(".pg2-jump-go");

    prevBtn.innerHTML = arrowSvg("left");
    nextBtn.innerHTML = arrowSvg("right");

    const maxPages = CONFIG.maxPages[section] || 1;
    const isFirst = page === 1;
    const isLast = page >= maxPages;

    currentEl.textContent = String(page);

    function setDisabled(btn, disabled) {
      if (disabled) {
        btn.classList.add("pg2-disabled");
        btn.setAttribute("aria-disabled", "true");
        btn.disabled = true;
      } else {
        btn.classList.remove("pg2-disabled");
        btn.removeAttribute("aria-disabled");
        btn.disabled = false;
      }
    }

    setDisabled(prevBtn, isFirst);
    setDisabled(nextBtn, isLast);

    prevBtn.addEventListener("click", () => {
      if (isFirst) return;
      location.href = buildUrl(section, page - 1, tagSlug);
    });
    nextBtn.addEventListener("click", () => {
      if (isLast) return;
      location.href = buildUrl(section, page + 1, tagSlug);
    });

    if (!goBtn) {
      goBtn = document.createElement("button");
      goBtn.type = "button";
      goBtn.className = "pg2-jump-go";
      goBtn.textContent = "前往"; //前往文本
      jumpWrap.appendChild(goBtn);
    }

    function acceptJump(valueStr) {
      const v = parseInt(valueStr, 10);
      if (!Number.isInteger(v) || v < 1 || v > maxPages) {
        jumpWrap.classList.remove("pg2-shake");
        void jumpWrap.offsetWidth;
        jumpWrap.classList.add("pg2-shake");
        jumpInput.value = "";
        setTimeout(() => jumpWrap.classList.remove("pg2-shake"), 420);
        jumpInput.focus();
        updateGoState();
        return;
      }
      const target = buildUrl(section, v, tagSlug);
      location.href = target;
    }

    jumpInput.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        acceptJump(jumpInput.value.trim());
      } else if (ev.key === "Escape") {
        jumpInput.value = "";
        updateGoState();
      }
    });

    jumpInput.addEventListener("input", () => {
      jumpInput.value = jumpInput.value.replace(/[^\d]/g, "");
      updateGoState();
    });

    goBtn.addEventListener("click", () => {
      acceptJump(jumpInput.value.trim());
    });

    function updateGoState() {
      const v = jumpInput.value.trim();
      const valid =
        /^\d+$/.test(v) &&
        Number.parseInt(v, 10) >= 1 &&
        Number.parseInt(v, 10) <= maxPages;
      if (valid) {
        goBtn.classList.remove("pg2-disabled");
        goBtn.disabled = false;
      } else {
        goBtn.classList.add("pg2-disabled");
        goBtn.disabled = true;
      }
    }
    updateGoState();

    currentEl.setAttribute("aria-current", "page");

    module.dataset.pg2Initialized = "true";
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
