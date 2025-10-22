(() => {
  // 延迟执行，确保 DOM 完全加载
  function initProgressBar() {
    const startEl = document.querySelector("[data-progress-start]");
    const endEl = document.querySelector("[data-progress-end]");

    if (!startEl || !endEl) {
      return;
    }

    // 检查是否已经存在进度条
    if (document.querySelector(".reading-progress")) {
      return;
    }

    const bar = document.createElement("div");
    bar.className = "reading-progress";
    document.body.appendChild(bar);

    let ticking = false;
    let startY = 0,
      endY = 0,
      totalH = 1;
    let hideTimer = null;
    const HIDE_DELAY = 600;
    let viewportHeight = window.innerHeight;

    function recalcBounds() {
      try {
        const scrollY = getScrollY();
        const sRect = startEl.getBoundingClientRect();
        const eRect = endEl.getBoundingClientRect();

        startY = scrollY + sRect.top;
        endY = scrollY + eRect.top;
        totalH = Math.max(1, endY - startY);
      } catch (error) {
        console.error("计算进度条边界时出错:", error);
      }
    }

    function getScrollY() {
      return (
        window.scrollY ||
        window.pageYOffset ||
        document.documentElement.scrollTop
      );
    }

    function setProgress(p) {
      const progress = Math.min(Math.max(p, 0), 1);
      bar.style.transform = `scaleX(${progress})`;
      bar.style.webkitTransform = `scaleX(${progress})`;
    }

    function updateProgress() {
      ticking = false;
      const scrollY = getScrollY();

      const docHeight = Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight
      );
      const maxScrollY = Math.max(0, docHeight - viewportHeight);
      const EPS = 2;

      if (scrollY >= maxScrollY - EPS) {
        setProgress(1);
        bar.style.opacity = "1";
        scheduleHide();
        return;
      }

      const p = (scrollY - startY) / totalH;

      if (p <= 0) {
        setProgress(0);
        bar.style.opacity = "0";
        return;
      }

      setProgress(p);
      bar.style.opacity = "1";
      scheduleHide();
    }

    function scheduleHide() {
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => {
        bar.style.opacity = "0";
      }, HIDE_DELAY);
    }

    function requestTick() {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(updateProgress);
      }
    }

    function handleResize() {
      viewportHeight = window.innerHeight;
      setTimeout(() => {
        recalcBounds();
        requestTick();
      }, 100);
    }

    function handleLoad() {
      setTimeout(() => {
        recalcBounds();
        requestTick();
      }, 500);
    }

    // 事件监听
    window.addEventListener("scroll", requestTick, { passive: true });
    window.addEventListener("resize", handleResize, { passive: true });
    window.addEventListener("orientationchange", handleResize, {
      passive: true,
    });

    // 初始化和监听
    recalcBounds();
    requestTick();

    // DOM 变化监听
    const observer = new MutationObserver(() => {
      setTimeout(() => {
        recalcBounds();
        requestTick();
      }, 100);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: false,
      characterData: false,
    });
  }

  // 多种初始化方式确保执行
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initProgressBar);
    window.addEventListener("load", initProgressBar);
  } else {
    // DOM 已经就绪，但稍微延迟确保所有元素加载完成
    setTimeout(initProgressBar, 100);
  }
})();
