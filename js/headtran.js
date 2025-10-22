// 顶栏毛玻璃自动化
window.addEventListener("load", () => {
  const header = document.querySelector(".site-header");
  if (!header) return;

  let lastState = null;
  const THRESHOLD = 50;
  const TRANSITION_MS = 320; // 与 CSS transition 保持一致或略小于 JS 超时

  const updateOnScroll = () => {
    const isScrolled = window.scrollY > THRESHOLD;
    if (isScrolled !== lastState) {
      header.classList.toggle("scrolled", isScrolled);
      lastState = isScrolled;
    }
  };

  // 初始化状态 & 监听滚动
  updateOnScroll();
  window.addEventListener("scroll", updateOnScroll, { passive: true });

  // 帮助函数：判断是否是“站内导航”
  function isInternalLink(a) {
    if (!a || !a.getAttribute) return false;
    const href = a.getAttribute("href");
    if (!href) return false;
    // 排除锚点、mailto、tel、javascript: 等
    if (
      href.startsWith("#") ||
      href.startsWith("mailto:") ||
      href.startsWith("tel:") ||
      href.startsWith("javascript:")
    )
      return false;
    // 目标是新标签或有 download 属性则不拦截
    if (a.target === "_blank" || a.hasAttribute("download")) return false;
    try {
      const url = new URL(href, location.href);
      return url.origin === location.origin;
    } catch (err) {
      return false;
    }
  }

  // 拦截站内链接点击
  document.addEventListener(
    "click",
    (e) => {
      const a = e.target.closest && e.target.closest("a");
      if (!a) return;
      if (!isInternalLink(a)) return;

      // 即已经在顶部
      if (!lastState) return;

      // 播放平滑回到纯色的过渡
      e.preventDefault();
      const href = a.href;

      // 加个过渡状态类防止交互
      header.classList.add("transitioning");

      // 触发过渡
      header.classList.remove("scrolled");

      // 用 transitionend 做精确回调，超时作为保险回退
      const fallback = setTimeout(() => {
        // 如果 transitionend 没来，强制导航
        location.href = href;
      }, TRANSITION_MS + 120); // 余量

      function onTransitionEnd(ev) {
        if (ev.target !== header) return;
        clearTimeout(fallback);
        header.removeEventListener("transitionend", onTransitionEnd);
        header.classList.remove("transitioning");
        // 最终跳转
        location.href = href;
      }

      header.addEventListener("transitionend", onTransitionEnd);
    },
    { capture: true }
  );
  document.addEventListener("submit", () => {
    if (lastState) {
      header.classList.remove("scrolled");
    }
  });
});
