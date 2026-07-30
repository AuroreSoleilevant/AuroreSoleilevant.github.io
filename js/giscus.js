(function () {
  const GISCUS_ORIGIN = "https://giscus.app";
  const LIGHT_THEME = "gruvbox";
  const DARK_THEME = "gruvbox_dark";
  const target = document.getElementById("giscus-container") || document.body;

  function siteTheme() {
    return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  }

  function giscusTheme(theme) {
    return theme === "dark" ? DARK_THEME : LIGHT_THEME;
  }

  function updateGiscusTheme(theme, frame) {
    const iframe =
      frame ||
      target.querySelector("iframe.giscus-frame") ||
      document.querySelector("iframe.giscus-frame");
    if (!iframe || !iframe.contentWindow) return;
    iframe.contentWindow.postMessage(
      {
        giscus: {
          setConfig: {
            theme: giscusTheme(theme),
          },
        },
      },
      GISCUS_ORIGIN
    );
  }

  const script = document.createElement("script");
  script.src = `${GISCUS_ORIGIN}/client.js`;
  script.async = true;
  script.crossOrigin = "anonymous";

  // 设置 Giscus 参数
  script.setAttribute(
    "data-repo",
    "AuroreSoleilevant/AuroreSoleilevant.github.io"
  );
  script.setAttribute("data-repo-id", "R_kgDOP4baWw");
  script.setAttribute("data-category", "Announcements");
  script.setAttribute("data-category-id", "DIC_kwDOP4baW84Cwye2");
  script.setAttribute("data-mapping", "pathname");
  script.setAttribute("data-strict", "1");
  script.setAttribute("data-reactions-enabled", "1");
  script.setAttribute("data-emit-metadata", "0");
  script.setAttribute("data-input-position", "top");
  script.setAttribute("data-theme", giscusTheme(siteTheme()));
  script.setAttribute("data-lang", "zh-CN");
  script.setAttribute("data-loading", "lazy");

  document.addEventListener("theme:changed", (event) => {
    const theme =
      event.detail && event.detail.theme === "dark" ? "dark" : "light";
    script.setAttribute("data-theme", giscusTheme(theme));
    updateGiscusTheme(theme);
  });

  /* 懒加载 iframe 完成后再同步一次，覆盖加载期间发生的主题切换。 */
  target.addEventListener(
    "load",
    (event) => {
      const frame = event.target;
      if (
        frame instanceof HTMLIFrameElement &&
        frame.classList.contains("giscus-frame")
      ) {
        updateGiscusTheme(siteTheme(), frame);
      }
    },
    true
  );

  // 插入到评论容器中
  target.appendChild(script);
})();
