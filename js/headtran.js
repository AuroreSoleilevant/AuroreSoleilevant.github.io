// 头顶玻璃的自动化
(function () {
  const THRESHOLD = 50;
  const TRANSITION_MS = 320;
  const EXTRA_MS = 120; // 保险余量
  const FALLBACK_MS = TRANSITION_MS + EXTRA_MS;

  if (window.__headtran_installed) return;
  window.__headtran_installed = true;

  let lastState = null;

  // 离开导航状态对象（null 或 { href, timeoutId, headerEl, onEnd }）
  let leaving = null;

  function getHeader() {
    return document.querySelector(".site-header");
  }

  // 将 isScrolled 应用到当前 header
  function applyState(isScrolled) {
    const h = getHeader();
    if (!h) return;
    if (lastState === null) {
      // 首次运行：从 DOM 推断初始状态以避免闪烁
      lastState = h.classList.contains("scrolled");
    }
    if (isScrolled !== lastState) {
      h.classList.toggle("scrolled", isScrolled);
      lastState = isScrolled;
    }
  }

  function updateOnScroll() {
    const isScrolled = window.scrollY > THRESHOLD;
    applyState(isScrolled);
  }

  // ---- 离开页面平滑导航逻辑 ----
  function isInternalLink(a) {
    if (!a || !a.getAttribute) return false;
    const href = a.getAttribute("href");
    if (!href) return false;
    if (
      href.startsWith("#") ||
      href.startsWith("mailto:") ||
      href.startsWith("tel:") ||
      href.startsWith("javascript:")
    )
      return false;
    if (a.target === "_blank" || a.hasAttribute("download")) return false;
    try {
      const url = new URL(href, location.href);
      return url.origin === location.origin;
    } catch (err) {
      return false;
    }
  }

  function cleanupLeaving() {
    if (!leaving) return;
    if (leaving.timeoutId) {
      clearTimeout(leaving.timeoutId);
    }
    if (leaving.headerEl && leaving.onEnd) {
      try {
        leaving.headerEl.removeEventListener("transitionend", leaving.onEnd);
      } catch (e) {}
    }
    leaving = null;
  }

  function finalizeNavigate(href) {
    cleanupLeaving();
    // 直接导航
    location.href = href;
  }

  function attachTransitionListenerToHeader(h, href) {
    if (!h) {
      // 没有 header，直接导航
      finalizeNavigate(href);
      return;
    }

    h.classList.remove("scrolled");
    h.classList.add("transitioning");

    // 清理旧的 listener
    if (leaving && leaving.headerEl && leaving.onEnd) {
      try {
        leaving.headerEl.removeEventListener("transitionend", leaving.onEnd);
      } catch (e) {}
    }

    const onEnd = (ev) => {
      // 只关心 header 的 transitionend
      if (ev.target !== h) return;
      // 名义上的过渡完成，导航
      h.removeEventListener("transitionend", onEnd);
      h.classList.remove("transitioning");
      finalizeNavigate(href);
    };

    h.addEventListener("transitionend", onEnd);

    // 保险超时：如果 transitionend 没触发（被替换或其他原因），强制导航
    const timeoutId = setTimeout(() => {
      // 若 header 已被替换，尝试在现有可见 header 上再次移除 scrolled（以给出视觉反馈），但直接导航
      const cur = getHeader();
      if (cur && cur !== h) {
        cur.classList.remove("scrolled");
        cur.classList.remove("transitioning");
      }
      // 导航
      finalizeNavigate(href);
    }, FALLBACK_MS);

    // 保存 leaving 状态
    leaving = {
      href,
      timeoutId,
      headerEl: h,
      onEnd,
    };
  }

  // 全局点击拦截（早期捕获），处理站内链接平滑过渡
  document.addEventListener(
    "click",
    (e) => {
      const a = e.target.closest && e.target.closest("a");
      if (!a) return;
      if (!isInternalLink(a)) return;

      // 如果当前并非已滚动（即 header 已是纯色），无需拦截
      const currentlyScrolled = window.scrollY > THRESHOLD;
      if (!currentlyScrolled) return;

      // 防止多次点击：如果已有 leaving 状态，忽略后续点击
      if (leaving) {
        e.preventDefault();
        return;
      }

      e.preventDefault();
      const href = a.href;

      const h = getHeader();
      attachTransitionListenerToHeader(h, href);
    },
    { capture: true }
  );

  // 表单提交类似处理直接移除 scrolled
  document.addEventListener("submit", (e) => {
    const currentlyScrolled = window.scrollY > THRESHOLD;
    if (!currentlyScrolled) return;
    // 尝试过渡（但不阻止提交）；如果需要阻止提交以等待，可改为 preventDefault + 手动提交
    const h = getHeader();
    if (h) {
      h.classList.remove("scrolled");
      h.classList.add("transitioning");
      // 不阻塞提交
      setTimeout(() => h.classList.remove("transitioning"), FALLBACK_MS);
    }
  });

  // 当 header 被替换时，如果我们正处在 leaving 状态，要把监听迁移到新 header
  function onHeaderReplaced() {
    if (!leaving) return;
    const current = getHeader();
    if (!current) return;
    // 如果 header 与我们最初监听的不是同一个元素，迁移监听
    if (leaving.headerEl !== current) {
      // 防止内存泄露
      try {
        if (leaving.headerEl && leaving.onEnd)
          leaving.headerEl.removeEventListener("transitionend", leaving.onEnd);
      } catch (e) {}
      // 先清掉旧超时，再用新的 timeout
      clearTimeout(leaving.timeoutId);
      attachTransitionListenerToHeader(current, leaving.href);
    }
  }

  // MutationObserver：监听 DOM 变化（子树变动），用于检测 header 被替换或者新 header 被注入
  const mo = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === "childList") {
        // 只要文档结构变动，尝试重新同步状态并迁移离开监听（若有）
        lastState = null; // 让下一次 applyState 从 DOM 读取真实 class
        updateOnScroll();
        onHeaderReplaced();
        break;
      }
    }
  });

  mo.observe(document.documentElement || document.body, {
    childList: true,
    subtree: true,
  });

  // pageshow / visibility / DOMContentLoaded 处理（bfcache 恢复等）
  window.addEventListener("pageshow", (ev) => {
    lastState = null;
    cleanupLeaving(); // 页面恢复时取消任何悬而未决的离开行为，犹豫就会_ _
    updateOnScroll();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      lastState = null;
      updateOnScroll();
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      lastState = null;
      updateOnScroll();
    });
  }

  // 侦听滚动
  window.addEventListener("scroll", updateOnScroll, { passive: true });

  // 短时间轮询作为保险（避免极端 race），运行几秒后停止
  const POLL_MS = 1000;
  const POLL_DURATION_MS = 5000;
  const pollId = setInterval(updateOnScroll, POLL_MS);
  setTimeout(() => clearInterval(pollId), POLL_DURATION_MS);
})();
