(() => {
  const head = document.head;

  // ================================
  // 全局 CSS / 字体配置
  // （字体）添加模板：
  // { rel, href, as?, type?, crossorigin? } 
  // ================================
  const links = [
    { rel: "preload", href: "/fonts/LXGWWenKai-latin.woff2", as: "font", type: "font/woff2", crossorigin: true },
    { rel: "preload", href: "/fonts/LXGWWenKai-cjk.woff2", as: "font", type: "font/woff2", crossorigin: true },
    { rel: "stylesheet", href: "/css/style.css" },  // 全局样式表
  ];

  // 创建并插入 link 标签
  links.forEach(linkInfo => {
    const link = document.createElement("link");
    Object.entries(linkInfo).forEach(([key, value]) => {
      if (value === true) link.setAttribute(key, ""); // 布尔属性
      else link.setAttribute(key, value);
    });
    head.appendChild(link);
  });

  // ================================
  // 全局 JS 列表
  // 同步顺序加载 JS
  // ================================
  const scripts = [
    "/js/fade.js",     // 顶栏 / 底栏动画逻辑
    "/js/backtop.js",  // 回到顶部按钮
    "/js/blink.js",    // 顶栏闪烁
  ];

  scripts.forEach(src => {
    try {
      // 使用 XMLHttpRequest 同步获取脚本内容
      const xhr = new XMLHttpRequest();
      xhr.open("GET", src, false); // false = 同步
      xhr.send(null);

      if (xhr.status === 200) {
        const script = document.createElement("script");
        script.textContent = xhr.responseText;
        head.appendChild(script);
      } else {
        console.error("加载失败：", src, "状态码：", xhr.status);
      }
    } catch (err) {
      console.error("加载失败：", src, err);
    }
  });

})();