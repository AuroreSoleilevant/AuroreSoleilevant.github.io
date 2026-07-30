(() => {
  const head = document.head;
  const version1 = "290726.1"; // style.css 版本号

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
      href: "/fonts/LXGWWenKai-cjk-site-extra.woff2",
      as: "font",
      type: "font/woff2",
      crossorigin: true,
    });
  }

  const links = [
    ...fontPreloads,
    { rel: "stylesheet", href: `/css/style.css?v=${version1}` }, // 全局样式表
    { rel: "stylesheet", href: `/css/special/style_peur.css` }, // 恐怖覆盖
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
    "/js/page-tags.js", // 正文标签 / 返回作品入口
    "/js/mots.js", // 字数统计
    "/js/backtop.js", // 回到顶部按钮
    "/js/blink.js", // 顶栏闪烁
    "/js/headtran.js", // 渐变顶栏玻璃
  ];

  loadFeatureScripts(deferredScripts);

})();
