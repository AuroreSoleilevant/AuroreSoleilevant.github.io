// chapters-sidebar.js — 侧边章节栏
(function () {
  const SIDEBAR_ID = "chapter-sidebar";
  const TOGGLE_ID = "chapter-toggle";
  const OVERLAY_CLASS = "chapter-overlay";
  const VISIBLE_CLASS = "visible";
  const POP_CLASS = "pop";
  const SHOW_THRESHOLD = 120;

  let toggleBtn = null;
  let sidebar = null;
  let overlay = null;
  let chaptersCache = null; // 缓存已加载的 JSON

  /* ---------- 解析当前 URL 得到作品名与当前章节 id ---------- */
  function getWorkInfo() {
    const parts = window.location.pathname.split("/").filter(Boolean); // 过滤空
    // 尝试找到 'histoire' 段
    const idx = parts.indexOf("histoire");
    if (idx === -1) return null;
    const workName = parts[idx + 1];
    if (!workName) return null;
    // current id：如果存在第三段则视为章节号，否则视为主页（id 0）
    const maybeId = parts[idx + 2];
    const currentId = maybeId ? Number.parseInt(maybeId, 10) : 0;
    // 如果 maybeId 存在但无法解析为整数，则设为 null
    const finalId = maybeId
      ? Number.isFinite(currentId)
        ? currentId
        : null
      : 0;
    const basePath = `/histoire/${encodeURIComponent(workName)}`;
    return { workName, currentId: finalId, basePath };
  }

  /* ---------- 创建侧栏（DOM） ---------- */
  function createSidebar() {
    if (sidebar) return sidebar;
    sidebar = document.createElement("aside");
    sidebar.id = SIDEBAR_ID;
    sidebar.setAttribute("role", "complementary");
    sidebar.setAttribute("aria-hidden", "true");

    // 生成骨架
    sidebar.innerHTML = `
      <div class="cs-header">
        <div class="cs-title">章节目录</div>
        <button class="cs-close" aria-label="关闭章节目录" title="关闭章节目录">
          <img src="/icons/icon-x.svg" alt="" width="35" height="35" />
        </button>
      </div>
      <ul class="chapter-list" aria-label="章节目录">
        <!-- 章节列表将由脚本动态替换 -->
      </ul>
      <div class="cs-footer" style="display:none;"></div>
    `;

    // 关闭按钮
    const closeBtn = sidebar.querySelector(".cs-close");
    closeBtn.addEventListener("click", (e) => {
      e.preventDefault();
      closeSidebar();
      try {
        closeBtn.blur();
      } catch (err) {}
    });

    // 创建遮罩并插入到 host（main 或 body，虽然感觉main里插了好多东西了）
    overlay = document.createElement("div");
    overlay.className = OVERLAY_CLASS;
    overlay.addEventListener("click", () => closeSidebar());

    const host = document.querySelector("main") || document.body;
    host.appendChild(sidebar);
    host.appendChild(overlay);

    // 鼠标悬停标记（用于 wheel 处理）
    let sidebarHover = false;
    sidebar.addEventListener("mouseenter", () => {
      sidebarHover = true;
    });
    sidebar.addEventListener("mouseleave", () => {
      sidebarHover = false;
    });

    // 平滑控制与防止边界滚动传递
    sidebar.style.scrollBehavior = "auto";
    sidebar.style.overscrollBehavior = "contain";
    sidebar.style.webkitOverflowScrolling = "touch";

    let rafId = null;
    let targetScroll = 0;
    let animating = false;
    const speedMultiplier = 1; // 速度，越大越快
    const ease = 0.04; // 越小越平滑，没弄懂这东西实际上是什么，但有用

    function startAnimate() {
      if (animating) return;
      animating = true;
      function step() {
        const current = sidebar.scrollTop;
        const diff = targetScroll - current;

        // 动态减速
        const near = Math.min(1, Math.abs(diff) / 60);
        const dynamicEase = ease * (0.5 + 0.5 * near);

        // 德芙缓动
        sidebar.scrollTop = current + diff * dynamicEase;

        // 当接近目标时，平滑停止而不是突停
        if (Math.abs(diff) < 0.8) {
          // 进入最后缓冲阶段，虽然感觉还是有点停快了
          sidebar.scrollTop = current + diff * 0.2; // 轻推一小段
          if (Math.abs(diff) < 0.2) {
            sidebar.scrollTop = targetScroll;
            animating = false;
            rafId = null;
            return;
          }
        }

        rafId = requestAnimationFrame(step);
      }

      rafId = requestAnimationFrame(step);
    }

    // wheel 事件处理
    sidebar.addEventListener(
      "wheel",
      function (e) {
        // 仅在侧栏打开且鼠标在侧栏上时生效（避免全局捕获滑的到处都是）
        if (!sidebar.classList.contains("open")) return;
        if (!sidebar.matches(":hover")) return;

        // 阻止默认以避免页面滚动
        e.preventDefault();

        // 累加目标位置（带倍速）
        const delta = e.deltaY * speedMultiplier;
        const maxScroll = sidebar.scrollHeight - sidebar.clientHeight;
        targetScroll = Math.max(0, Math.min(maxScroll, targetScroll + delta));

        // 如果尚未初始化 targetScroll（首次），设为当前位置
        if (typeof targetScroll !== "number" || isNaN(targetScroll)) {
          targetScroll = sidebar.scrollTop;
        }

        // 启动动画
        startAnimate();
      },
      { passive: false }
    );

    // ESC 关闭（无论 focus 在何处），总得有人用键盘
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && sidebar.classList.contains("open")) {
        closeSidebar();
      }
    });

    // 当侧栏创建完毕，尝试加载对应作品的章节数据
    loadChapters();

    return sidebar;
  }

  /* ---------- 创建切换按钮 ---------- */
  function createToggleButton() {
    if (toggleBtn) return toggleBtn;
    toggleBtn = document.createElement("button");
    toggleBtn.id = TOGGLE_ID;
    toggleBtn.className = "back-to-top chapter-button";
    toggleBtn.title = "章节目录";
    toggleBtn.setAttribute("aria-label", "章节目录");
    toggleBtn.innerHTML =
      '<img class="backtop-icon" src="/icons/icon-chapitre.svg" alt="" aria-hidden="true">';
    toggleBtn.addEventListener("click", (e) => {
      if (e && e.preventDefault) e.preventDefault();
      if (sidebar && sidebar.classList.contains("open")) {
        closeSidebar();
      } else {
        openSidebar();
      }
      try {
        toggleBtn.blur();
      } catch (err) {}
    });

    const host = document.querySelector("main") || document.body;

    host.appendChild(toggleBtn);
    return toggleBtn;
  }

  /* ---------- 打开 / 关闭 ---------- */
  function openSidebar() {
    createSidebar();
    sidebar.classList.add("open");
    sidebar.setAttribute("aria-hidden", "false");
    overlay.style.display = "";
    // focus 第一个链接以便可访问
    const firstLink = sidebar.querySelector(".chapter-list a");
    if (firstLink) firstLink.focus();
  }

  function closeSidebar() {
    if (!sidebar) return;
    sidebar.classList.remove("open");
    sidebar.setAttribute("aria-hidden", "true");
    // 隐藏 overlay 由 CSS 控制透明度
  }

  /* ---------- 从 JSON 加载章节并渲染 ---------- */
  async function loadChapters() {
    const info = getWorkInfo();
    const ul = sidebar.querySelector(".chapter-list");
    if (!ul) return;

    // 清空占位，如果我忘了的话
    ul.innerHTML = "";

    if (!info) {
      // 如果无作品信息，则不尝试加载；保持空列表
      return;
    }

    const jsonPath = `/json/histoire/${encodeURIComponent(info.workName)}.json`;

    // 如果已缓存，直接渲染缓存
    if (chaptersCache && chaptersCache.workName === info.workName) {
      renderChapters(chaptersCache.data, info);
      return;
    }

    try {
      const resp = await fetch(jsonPath, { cache: "no-cache" });
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      const data = await resp.json();
      // 缓存（包括 workName）
      chaptersCache = { workName: info.workName, data };
      renderChapters(data, info);
    } catch (err) {
      console.error("无法加载章节 JSON:", jsonPath, err);
      // 显示友好提示，但是bug可一点都不友好
      const li = document.createElement("li");
      li.style.opacity = "0.85";
      li.style.padding = "10px";
      li.style.color = "#666";
      li.textContent = "章节目录加载失败";
      ul.appendChild(li);
    }
  }

  /* ---------- 渲染章节列表 ---------- */
  function renderChapters(data, info) {
    const ul = sidebar.querySelector(".chapter-list");
    if (!ul) return;
    ul.innerHTML = "";

    // { chapters: [...] }
    const list = Array.isArray(data)
      ? data
      : data && data.chapters
      ? data.chapters
      : [];
    if (!Array.isArray(list) || list.length === 0) {
      const li = document.createElement("li");
      li.style.opacity = "0.85";
      li.style.padding = "10px";
      li.style.color = "#666";
      li.textContent = "暂无章节";
      ul.appendChild(li);
      return;
    }

    // 当前页面章节 id（0 表示作品主页）
    const currentId = info.currentId;

    list.forEach((item) => {
      const id = Number(item.id);
      const title = item.title || "";

      // 构造 href：若 id === 0 -> basePath （/histoire/name）
      // 其余 -> /histoire/name/{id}
      const href = id === 0 ? info.basePath : `${info.basePath}/${id}`;

      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = href;
      a.setAttribute("data-id", String(id));
      // 显示格式： id + 空格 + title；但 id===0 时只显示 title（不显示 0）
      a.textContent = id === 0 ? title : `${id} ${title}`;
      a.setAttribute("role", "link");

      // 点击默认由 anchor 导航；仍然在 click 时关闭侧栏以保持体验
      a.addEventListener("click", (ev) => {
        // let normal navigation happen; but close sidebar to give instant feedback
        try {
          closeSidebar();
        } catch (err) {}
      });

      // 高亮当前章节
      if (
        currentId !== null &&
        Number.isFinite(currentId) &&
        id === currentId
      ) {
        a.classList.add("active");
      }

      li.appendChild(a);
      ul.appendChild(li);
    });
  }

  /* ---------- 其余函数，也许没用上，但是先留着，以后的事情只有天知道 ---------- */
  function showToggleButton() {
    createToggleButton();
    if (toggleBtn.classList.contains(VISIBLE_CLASS)) return;
    toggleBtn.classList.add(VISIBLE_CLASS);
    toggleBtn.classList.remove(POP_CLASS);
    void toggleBtn.offsetWidth;
    toggleBtn.classList.add(POP_CLASS);
  }
  function hideToggleButton() {
    createToggleButton();
    toggleBtn.classList.remove(VISIBLE_CLASS);
    toggleBtn.classList.remove(POP_CLASS);
  }

  /* 这两个别动 */
  function readCSSVarInt(name, fallback = 0) {
    const val = getComputedStyle(document.documentElement).getPropertyValue(
      name
    );
    const n = parseInt(val, 10);
    return Number.isFinite(n) ? n : fallback;
  }

  function updateToggleOffset() {
    createToggleButton();
    const base = readCSSVarInt("--backtop-bottom", 96);
    const btnSize = readCSSVarInt("--backtop-size", 48);
    const gap = readCSSVarInt("--comment-gap", 12);
  }

  function pageIsScrollable() {
    return document.documentElement.scrollHeight > window.innerHeight + 2;
  }

  // init
  function init() {
    createSidebar();
    createToggleButton();

    // 立刻更新按钮位置，防止初始跳动
    updateToggleOffset();

    // 恢复可见并显示（避免初始跳动）
    toggleBtn.style.visibility = "";
    toggleBtn.classList.add("visible");

    window.addEventListener(
      "resize",
      () => {
        updateToggleOffset();
      },
      { passive: true }
    );

    window.addEventListener("pageshow", () => {
      updateToggleOffset();
    });

    // 触摸动画
    toggleBtn.addEventListener(
      "touchstart",
      () => {
        toggleBtn.classList.remove("pop");
        void toggleBtn.offsetWidth;
      },
      { passive: true }
    );

    toggleBtn.addEventListener(
      "touchend",
      () => {
        try {
          toggleBtn.blur();
        } catch (e) {}
      },
      { passive: true }
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
