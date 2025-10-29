(() => {
  const head = document.head;
  const version1 = "191025.1"; // style.css 版本号

  // ------------------------
  // 同步注入脚本
  // ------------------------
  function injectSyncScript(src) {
    // 使用同步 XHR 获取并立即以内联脚本形式注入（感觉得慎用）
    try {
      const xhr = new XMLHttpRequest();
      xhr.open("GET", src, false); // false = 同步，确保脚本尽早执行
      xhr.send(null);
      if (xhr.status === 200) {
        const s = document.createElement("script");
        s.textContent = xhr.responseText;
        head.appendChild(s);
        return true;
      } else {
        console.error("同步加载失败：", src, "状态码：", xhr.status);
      }
    } catch (err) {
      console.error("同步加载出错：", src, err);
    }
    return false;
  }

  // ------------------------
  // 辅助：非阻塞/延迟注入脚本
  // ------------------------
  function preloadAndDeferScripts(srcArray) {
    srcArray.forEach((src) => {
      try {
        const pl = document.createElement("link");
        pl.setAttribute("rel", "preload");
        pl.setAttribute("as", "script");
        pl.setAttribute("href", src);
        head.appendChild(pl);
      } catch (e) {
        // 忽略预加载失败
        console.warn("预加载提示创建失败：", src, e);
      }
    });

    // 按顺序插入带 defer 的 script
    srcArray.forEach((src) => {
      try {
        const s = document.createElement("script");
        s.setAttribute("src", src);
        // 减少解析时阻塞
        s.defer = true;
        head.appendChild(s);
      } catch (e) {
        // 回退到同步 XHR
        console.warn("defer 注入失败，改回同步加载：", src, e);
        injectSyncScript(src);
      }
    });
  }

  // ================================
  // 最快加载区
  // ================================
  injectSyncScript("/js/fade.js");
  injectSyncScript("/js/img.js");

  // ================================
  // 次优加载区
  // ================================
  const links = [
    {
      rel: "preload",
      href: "/fonts/LXGWWenKai-latin.woff2",
      as: "font",
      type: "font/woff2",
      crossorigin: true,
    },
    {
      rel: "preload",
      href: "/fonts/LXGWWenKai-cjk.woff2",
      as: "font",
      type: "font/woff2",
      crossorigin: true,
    },
    { rel: "stylesheet", href: `/css/style.css?v=${version1}` }, // 全局样式表
    { rel: "stylesheet", href: `/css/progression.css` }, // 进度条
    // { rel: "stylesheet", href: `/css/mascot.css` }, // 左下角小马
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

  // ================================
  // 普通加载区
  // ================================
  const syncScripts = [
    // 同步执行内容位置
  ];

  const deferredScripts = [
    "/js/mots.js", // 字数统计
    "/js/backtop.js", // 回到顶部按钮
    "/js/blink.js", // 顶栏闪烁
    "/js/headtran.js", // 渐变顶栏玻璃
    "/js/progression.js", // 阅读进度条
    "/js/mascot.js", // 左下角小马
  ];

  // 同步脚本（仅在数组中有项时才执行同步加载）
  syncScripts.forEach((src) => injectSyncScript(src));

  // deferred / non-blocking 脚本
  preloadAndDeferScripts(deferredScripts);
})();
