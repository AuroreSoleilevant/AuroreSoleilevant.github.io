// histoire-loader.js
// 故事类用的额外加载器

(function () {
  const modules = [
    { type: "css", href: "/css/intro.css" },
    { type: "css", href: "/css/chapters-sidebar.css" },
    { type: "js", src: "/js/chapters-sidebar.js" },
    { type: "css", href: "/css/chapter-nav.css" },
    { type: "js", src: "/js/chapter-nav.js" },
  ];

  // 加载 CSS（带防重复）
  function loadCSS(href) {
    if (document.querySelector(`link[href="${href}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }

  // 加载 JS（顺序加载）
  function loadJS(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }
      const s = document.createElement("script");
      s.src = src;
      s.defer = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error(`加载失败 ${src}`));
      document.head.appendChild(s);
    });
  }

  // 按顺序加载所有模块
  (async function loadAll() {
    try {
      for (const mod of modules) {
        if (mod.type === "css") {
          loadCSS(mod.href);
        } else if (mod.type === "js") {
          await loadJS(mod.src);
        }
      }
    } catch (err) {
      console.error("[Histoire Loader] 加载错误:", err);
    }
  })();
})();
