/* 进度条 */
(() => {
  const startEl = document.querySelector("[data-progress-start]");
  const endEl = document.querySelector("[data-progress-end]");
  if (!startEl || !endEl) return;

  const bar = document.createElement("div");
  bar.className = "reading-progress";
  document.body.appendChild(bar);

  let ticking = false;
  let startY = 0,
    endY = 0,
    totalH = 1;
  let hideTimer = null;
  const HIDE_DELAY = 600;

  // 视口高度缓存
  let viewportHeight = window.innerHeight;

  function recalcBounds() {
    const scrollY = getScrollY();
    const sRect = startEl.getBoundingClientRect();
    const eRect = endEl.getBoundingClientRect();

    // 计算方法
    startY = scrollY + sRect.top;
    endY = scrollY + eRect.top;

    // 未来可能的动态工具栏
    totalH = Math.max(1, endY - startY);

    console.log("Bounds recalculated:", {
      startY,
      endY,
      totalH,
      viewportHeight,
    });
  }

  // 统一的滚动位置获取
  function getScrollY() {
    return (
      window.scrollY || window.pageYOffset || document.documentElement.scrollTop
    );
  }

  function setProgress(p) {
    const progress = Math.min(Math.max(p, 0), 1);
    bar.style.transform = `scaleX(${progress})`;
    bar.style.webkitTransform = `scaleX(${progress})`; // 移动端兼容
  }

  function updateProgress() {
    ticking = false;
    const scrollY = getScrollY();

    if (scrollY < startY) {
      setProgress(0);
      bar.style.opacity = "0";
      return;
    }

    if (scrollY >= endY - viewportHeight) {
      setProgress(1);
      bar.style.opacity = "1";
      scheduleHide();
      return;
    }

    const p = (scrollY - startY) / totalH;
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
    // 延迟重新计算
    setTimeout(() => {
      recalcBounds();
      requestTick();
    }, 100);
  }

  function handleLoad() {
    // 页面完全加载后重新计算
    setTimeout(() => {
      recalcBounds();
      requestTick();
    }, 500);
  }

  // 事件监听
  window.addEventListener("scroll", requestTick, { passive: true });
  window.addEventListener("resize", handleResize, { passive: true });
  window.addEventListener("orientationchange", handleResize, { passive: true });

  // 监听页面加载完成
  if (document.readyState === "loading") {
    window.addEventListener("load", handleLoad);
  } else {
    handleLoad();
  }

  // 监听DOM变化
  const observer = new MutationObserver(() => {
    setTimeout(() => {
      recalcBounds();
      requestTick();
    }, 100);
  });

  if (startEl.parentNode && endEl.parentNode) {
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: false,
      characterData: false,
    });
  }

  // 初始计算
  recalcBounds();
  requestTick();
})();
