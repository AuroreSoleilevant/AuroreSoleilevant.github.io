(function () {
  const script = document.createElement("script");
  script.src = "https://giscus.app/client.js";
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
  script.setAttribute("data-theme", "gruvbox");
  script.setAttribute("data-lang", "zh-CN");
  script.setAttribute("data-loading", "lazy");

  // 插入到评论容器中
  const target = document.getElementById("giscus-container") || document.body;
  target.appendChild(script);
})();
