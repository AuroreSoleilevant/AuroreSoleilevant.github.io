// chapters-sidebar.js，记得在同名css之后加载
(function () {
  const SIDEBAR_ID = "chapter-sidebar";
  const TOGGLE_ID = "chapter-toggle";
  const OVERLAY_CLASS = "chapter-overlay";
  const VISIBLE_CLASS = "visible";
  const POP_CLASS = "pop";
  const SHOW_THRESHOLD = 120; // 与回到顶部共享阈值一致

  let toggleBtn = null;
  let sidebar = null;
  let overlay = null;

  // 创建侧栏 DOM（占位链接）
  function createSidebar() {
    if (sidebar) return sidebar;
    sidebar = document.createElement("aside");
    sidebar.id = SIDEBAR_ID;
    // 添加 data-work 属性由后续 JS 覆写，不知道能否用上
    sidebar.setAttribute("role", "complementary");
    sidebar.setAttribute("aria-hidden", "true");

    sidebar.innerHTML = `
      <div class="cs-header">
        <div class="cs-title">章节目录</div>
        <button class="cs-close" aria-label="关闭章节目录" title="关闭章节目录">
          <img src="/icons/icon-x.svg" alt="" width="35" height="35" />
        </button>
      </div>
      <ul class="chapter-list" aria-label="章节目录">
        <!-- 占位章节，后期由 JSON 替换 -->
        <li><a href="#" data-id="1">第 1 章 · 苹果派（占位）</a></li>
        <li><a href="#" data-id="2">第 2 章 · 萝卜干（占位）</a></li>
        <li><a href="#" data-id="3">第 3 章 · 榨菜（占位）</a></li>
      </ul>
    `;

    // 关闭按钮行为
    const closeBtn = sidebar.querySelector(".cs-close");
    closeBtn.addEventListener("click", (e) => {
      e.preventDefault();
      closeSidebar();
      try {
        closeBtn.blur();
      } catch (e) {}
    });

    // 点击章节项：目前占位行为（后面可能换）
    sidebar.querySelectorAll(".chapter-list a").forEach((a) => {
      a.addEventListener("click", (ev) => {
        ev.preventDefault();
        // 暂时模拟跳转
        const id = a.getAttribute("data-id");
        // 简单反馈：关闭并在控制台打印（实际行为由后续JS决定）
        console.log("章节点击：", id);
        closeSidebar();
      });
    });

    // 创建遮罩紧跟侧栏
    overlay = document.createElement("div");
    overlay.className = OVERLAY_CLASS;
    overlay.addEventListener("click", () => closeSidebar());

    const host = document.querySelector("main") || document.body;
    host.appendChild(sidebar);
    host.appendChild(overlay);

    // 鼠标悬停标记
    let sidebarHover = false;
    sidebar.addEventListener("mouseenter", () => {
      sidebarHover = true;
    });
    sidebar.addEventListener("mouseleave", () => {
      sidebarHover = false;
    });

    // 让侧栏滚动平滑化（是CSS控制）
    sidebar.style.scrollBehavior = "smooth";

    // wheel 处理：鼠标在侧栏上时，页面不滚动
    sidebar.addEventListener(
      "wheel",
      function (e) {
        // 仅在侧栏展开且鼠标确实在上面时生效
        if (!sidebar.classList.contains("open") || !sidebarHover) return;

        // 检查是否可滚动
        const canScroll = sidebar.scrollHeight > sidebar.clientHeight + 1;
        if (!canScroll) return; // 无需滚动，直接放行

        // 阻止页面滚动
        e.preventDefault();

        // 平滑滚动逻辑
        const speed = Math.min(Math.abs(e.deltaY) / 20 + 1.5, 4); // 动态加速，最大 4 倍，大概不用改了
        sidebar.scrollBy({
          top: e.deltaY * speed,
          behavior: "smooth",
        });
      },
      { passive: false }
    );

    // 键盘 Esc 关闭
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && sidebar.classList.contains("open")) {
        closeSidebar();
      }
    });

    return sidebar;
  }

  // 创建切换按钮（复用回顶基础样式）
  function createToggleButton() {
    if (toggleBtn) return toggleBtn;
    toggleBtn = document.createElement("button");
    toggleBtn.id = TOGGLE_ID;
    // 与现有按钮并存，复用相同基础 class
    toggleBtn.className = "back-to-top chapter-button";
    toggleBtn.title = "章节目录";
    toggleBtn.setAttribute("aria-label", "章节目录");
    // 按钮SVG 地址
    toggleBtn.innerHTML =
      '<img class="backtop-icon" src="/icons/icon-chapitre.svg" alt="" aria-hidden="true">';

    toggleBtn.addEventListener("click", (e) => {
      if (e && e.preventDefault) e.preventDefault();
      // toggle
      if (sidebar && sidebar.classList.contains("open")) {
        closeSidebar();
      } else {
        openSidebar();
      }
      // blur + 轻隐藏检测
      try {
        toggleBtn.blur();
      } catch (e) {}
    });

    const host = document.querySelector("main") || document.body;
    host.appendChild(toggleBtn);
    return toggleBtn;
  }

  // 打开侧栏
  function openSidebar() {
    createSidebar();
    sidebar.classList.add("open");
    sidebar.setAttribute("aria-hidden", "false");
    overlay.style.display = ""; // 由 CSS 控制 opacity/pointer-events
    // focus 第一个链接以便可访问
    const firstLink = sidebar.querySelector(".chapter-list a");
    if (firstLink) firstLink.focus();
  }

  // 关闭侧栏
  function closeSidebar() {
    if (!sidebar) return;
    sidebar.classList.remove("open");
    sidebar.setAttribute("aria-hidden", "true");
  }

  // 显示 / 隐藏 toggle 按钮
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

  // 读取 CSS 变量的辅助
  function readCSSVarInt(name, fallback = 0) {
    const val = getComputedStyle(document.documentElement).getPropertyValue(
      name
    );
    const n = parseInt(val, 10);
    return Number.isFinite(n) ? n : fallback;
  }

  // 计算并设置 toggle 按钮的 bottom（放在评论按钮之上防止跳来跳去）
  function updateToggleOffset() {
    createToggleButton();
    // 与其他脚本一致读取这些变量
    const base = readCSSVarInt("--backtop-bottom", 96);
    const btnSize = readCSSVarInt("--backtop-size", 48);
    const gap = readCSSVarInt("--comment-gap", 12);
    // 计算：把 toggle 放在评论按钮上方
    const toggleBottom = base + btnSize * 2 + gap * 2;
    toggleBtn.style.bottom = toggleBottom + "px";
  }

  // 判断页面是否可滚动
  function pageIsScrollable() {
    return document.documentElement.scrollHeight > window.innerHeight + 2;
  }

  // 简单的显示判断（与回到顶部共享阈值）
  function checkToggleVisibility() {
    createToggleButton();
    if (!pageIsScrollable()) {
      hideToggleButton();
      return;
    }
    if (window.scrollY > SHOW_THRESHOLD) {
      showToggleButton();
    } else {
      hideToggleButton();
    }
  }

  // 安装滚动节流（rAF）
  function installScrollHandler() {
    let ticking = false;
    function onScroll() {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(() => {
          checkToggleVisibility();
          ticking = false;
        });
      }
    }
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  // 初始化
  function init() {
    createSidebar();
    createToggleButton();
    //一律显示
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
