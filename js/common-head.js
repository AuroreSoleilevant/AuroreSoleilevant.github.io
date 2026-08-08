(() => {
  const head = document.head;
  const version1 = "080826.header-toggle.1"; // style.css 版本号
  const THEME_STORAGE_KEY = "spica-theme-choice";
  const HEADER_CACHE_KEY = "spica-header-fragment";

  // 暴露给 fade.js，确保读写使用同一个会话缓存键。
  window.__SPICA_HEADER_CACHE_KEY = HEADER_CACHE_KEY;

  // 目录页会在 JSON 列表到达后才变成长页。首帧就预留原生滚动槽，
  // 避免滚动条稍后出现时把整个布局向左顶回去。
  const root = document.documentElement;
  root.style.overflowY = "scroll";
  root.style.scrollbarGutter = "stable";

  // 在基础样式请求前确定主题，避免普通页面冷启动时先闪出错误底色。
  function applyInitialTheme() {
    let storedTheme = null;
    try {
      const value = sessionStorage.getItem(THEME_STORAGE_KEY);
      if (value === "light" || value === "dark") storedTheme = value;
    } catch (e) {
      /* sessionStorage 不可用时继续跟随系统 */
    }

    const systemDark =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = storedTheme || (systemDark ? "dark" : "light");
    root.dataset.theme = theme;
    root.style.colorScheme = `only ${theme}`;
  }

  applyInitialTheme();

  // 实测滚动槽是否占位：只有真正的 overlay 滚动条才自动隐藏。
  function installScrollbarActivity() {
    if (window.__SPICA_SCROLLBAR_ACTIVITY_INSTALLED) return;
    window.__SPICA_SCROLLBAR_ACTIVITY_INSTALLED = true;

    let hideTimer = null;
    let resizeTimer = null;

    const clearActivity = () => {
      if (hideTimer !== null) clearTimeout(hideTimer);
      hideTimer = null;
      root.classList.remove("is-scrollbar-active");
    };

    const detectScrollbarMode = () => {
      const gutterWidth = Math.max(
        0,
        Math.round(window.innerWidth - root.clientWidth)
      );
      const usesOverlay = gutterWidth === 0;
      root.classList.toggle("has-overlay-scrollbar", usesOverlay);
      root.classList.toggle("has-classic-scrollbar", !usesOverlay);
      if (!usesOverlay) clearActivity();
    };

    const reveal = () => {
      if (!root.classList.contains("has-overlay-scrollbar")) return;
      root.classList.add("is-scrollbar-active");
      if (hideTimer !== null) clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => {
        root.classList.remove("is-scrollbar-active");
        hideTimer = null;
      }, 700);
    };

    window.addEventListener("scroll", reveal, { passive: true });
    window.addEventListener(
      "pointermove",
      (event) => {
        if (event.clientX >= window.innerWidth - 18) reveal();
      },
      { passive: true }
    );
    window.addEventListener(
      "resize",
      () => {
        if (resizeTimer !== null) clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(detectScrollbarMode, 120);
      },
      { passive: true }
    );

    if (document.readyState === "loading") {
      document.addEventListener(
        "DOMContentLoaded",
        () => requestAnimationFrame(detectScrollbarMode),
        { once: true }
      );
    } else {
      requestAnimationFrame(detectScrollbarMode);
    }
  }

  installScrollbarActivity();

  // 站内完整页面跳转会销毁旧 DOM，而顶栏片段原本要等 DOMContentLoaded
  // 之后再次请求。优先恢复上一页保存的真实片段，避免新文档短暂没有顶栏。
  function restoreCachedHeader() {
    const placeholder = document.getElementById("header-placeholder");
    if (!placeholder || placeholder.querySelector(".site-header")) return;

    let cachedHTML = "";
    try {
      cachedHTML = sessionStorage.getItem(HEADER_CACHE_KEY) || "";
    } catch (e) {
      return;
    }
    if (!cachedHTML.trim()) return;

    placeholder.innerHTML = cachedHTML;
    if (placeholder.querySelector(".site-header")) {
      placeholder.dataset.headerSource = "session-cache";
      return;
    }

    // 缓存异常时不留下无效内容，交回 fade.js 的正常请求流程。
    placeholder.textContent = "";
    delete placeholder.dataset.headerSource;
    try {
      sessionStorage.removeItem(HEADER_CACHE_KEY);
    } catch (e) {
      /* sessionStorage 不可用时无需额外处理 */
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", restoreCachedHeader, {
      once: true,
    });
  } else {
    restoreCachedHeader();
  }

  function installMainVisibilityFallback() {
    if (window.__mainVisibilityFallbackInstalled) return;
    window.__mainVisibilityFallbackInstalled = true;
    const visibilityState =
      window.__mainVisibilityState ||
      (window.__mainVisibilityState = {
        fallbackShown: false,
        leaving: false,
      });

    let timer = null;
    const clear = () => {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      document.removeEventListener("main:visible", onVisible);
      document.removeEventListener("main:leaving", onLeaving);
      document.removeEventListener("DOMContentLoaded", start);
      window.removeEventListener("beforeunload", onLeaving);
    };
    const onVisible = () => clear();
    const onLeaving = () => clear();
    const start = () => {
      const main = document.querySelector("main");
      if (
        visibilityState.leaving ||
        !main ||
        main.classList.contains("loaded")
      ) {
        clear();
        return;
      }
      timer = setTimeout(() => {
        const currentMain = document.querySelector("main");
        if (
          !visibilityState.leaving &&
          currentMain &&
          !currentMain.classList.contains("loaded")
        ) {
          currentMain.classList.add("loaded");
          visibilityState.fallbackShown = true;
          document.dispatchEvent(new CustomEvent("main:visible"));
        }
        clear();
      }, 1200);
    };

    document.addEventListener("main:visible", onVisible);
    document.addEventListener("main:leaving", onLeaving);
    window.addEventListener("beforeunload", onLeaving, { once: true });
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", start, { once: true });
    } else {
      start();
    }
  }

  function loadProgressionIfNeeded() {
    const start = document.querySelector("[data-progress-start]");
    const end = document.querySelector("[data-progress-end]");
    if (!start || !end || window.__progressionResourcesStarted) return;
    window.__progressionResourcesStarted = true;

    let scriptStarted = false;
    const loadScript = () => {
      if (scriptStarted) return;
      scriptStarted = true;
      const script = document.createElement("script");
      script.src = "/js/progression.js";
      script.addEventListener("error", () => {
        console.error("脚本加载失败：/js/progression.js");
      });
      head.appendChild(script);
    };

    const stylesheet = document.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = "/css/progression.css";
    stylesheet.addEventListener("load", loadScript, { once: true });
    stylesheet.addEventListener(
      "error",
      () => {
        console.error("样式加载失败：/css/progression.css");
        loadScript();
      },
      { once: true }
    );
    head.appendChild(stylesheet);
  }

  function scheduleProgressionLoad() {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", loadProgressionIfNeeded, {
        once: true,
      });
    } else {
      loadProgressionIfNeeded();
    }
  }

  // ------------------------
  // 辅助：动态注入功能脚本
  // ------------------------
  function loadFeatureScripts(srcArray) {
    srcArray.forEach((src) => {
      try {
        const s = document.createElement("script");
        s.setAttribute("src", src);
        head.appendChild(s);
      } catch (e) {
        console.warn("脚本注入失败：", src, e);
      }
    });
  }

  // ================================
  // 最快加载区
  // ================================
  installMainVisibilityFallback();
  const fadeScript = document.createElement("script");
  fadeScript.src = "/js/fade.js";
  fadeScript.addEventListener("error", () => {
    console.error("脚本加载失败：/js/fade.js");
  });
  head.appendChild(fadeScript);
  const imgScript = document.createElement("script");
  imgScript.src = "/js/img.js";
  head.appendChild(imgScript);

  // ================================
  // 次优加载区
  // ================================
  const fontPreloads = [
    {
      rel: "preload",
      href: "/fonts/LXGWWenKai-latin-symbols.woff2",
      as: "font",
      type: "font/woff2",
      crossorigin: true,
    },
    {
      rel: "preload",
      href: "/fonts/LXGWWenKai-cjk-core.woff2",
      as: "font",
      type: "font/woff2",
      crossorigin: true,
    },
  ];
  if (location.pathname !== "/" && location.pathname !== "/index.html") {
    fontPreloads.push({
      rel: "preload",
      href: "/fonts/LXGWWenKai-cjk-site-extra.woff2?v=e4e4b870846c",
      as: "font",
      type: "font/woff2",
      crossorigin: true,
    });
  }

  const links = [
    ...fontPreloads,
    {
      rel: "stylesheet",
      href: `/css/style.css?v=${version1}`,
      id: "spica-base-style",
    }, // 全局样式表
    { rel: "stylesheet", href: `/css/mascot.css` }, // 左下角小马
    { rel: "icon", href: "/icons/logo.png", type: "image/x-icon" },
  ];

  links.forEach((linkInfo) => {
    const link = document.createElement("link");
    Object.entries(linkInfo).forEach(([key, value]) => {
      if (value === true) link.setAttribute(key, "");
      else link.setAttribute(key, value);
    });
    head.appendChild(link);
  });

  scheduleProgressionLoad();

  // ================================
  // 普通加载区
  // ================================
  const deferredScripts = [
    "/js/theme.js", // 普通页面明暗主题
    "/js/mots.js", // 字数统计
    "/js/backtop.js", // 回到顶部按钮
    "/js/blink.js", // 顶栏闪烁
    "/js/headtran.js", // 渐变顶栏玻璃
    "/js/mascot.js", // 左下角小马
    "/js/mirror-notice.js", // 中国大陆镜像提示
    "/js/skip-link.js", // 键盘跳至正文
  ];

  loadFeatureScripts(deferredScripts);

})();
