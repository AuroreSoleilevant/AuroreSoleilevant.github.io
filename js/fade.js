// 淡入淡出
(() => {
  const FADE_CLASS = 'loaded';
  let isTransitioning = false;

  // 获取元素 transition 时间（ms）
  function getTransitionMs(el) {
    try {
      const cs = getComputedStyle(el).transitionDuration || '';
      const first = cs.split(',')[0].trim();
      if (!first) return 400;
      return first.endsWith('ms') ? parseFloat(first) : parseFloat(first) * 1000;
    } catch (e) {
      return 400;
    }
  }

  // 执行淡入
  function fadeIn() {
    const main = document.querySelector('main');
    if (!main) return;

    isTransitioning = false;

    main.classList.remove(FADE_CLASS);
    void main.offsetWidth; // 强制重绘

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        main.classList.add(FADE_CLASS);
      });
    });
  }

  // 内部链接点击处理：淡出 + 跳转
  function onDocumentClick(e) {
    const a = e.target.closest('a');
    if (!a) return;

    const href = a.getAttribute('href');
    if (!href) return;

    // 忽略外部、新标签、mailto/tel/javascript/hash
    if (a.target === '_blank' || a.hasAttribute('download')) return;
    if (href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) return;
    if (href.startsWith('#')) return;

    let url;
    try {
      url = new URL(href, location.href);
    } catch (err) {
      return;
    }

    if (url.origin !== location.origin) return; // 只处理站内
    if (url.pathname === location.pathname && url.hash && url.hash !== '') return;

    e.preventDefault();
    if (isTransitioning) return;
    isTransitioning = true;

    const main = document.querySelector('main');
    if (!main) {
      window.location.href = url.href;
      return;
    }

    // 淡出：移除类
    main.classList.remove(FADE_CLASS);

    const wait = Math.max(getTransitionMs(main) + 30, 80);
    setTimeout(() => {
      window.location.href = url.href;
    }, wait);
  }

  // 页面首次加载
  document.addEventListener('DOMContentLoaded', fadeIn);

  // 浏览器前进/后退（bfcache）
  window.addEventListener('pageshow', (event) => {
    fadeIn();
  });

  // 点击内部链接
  document.addEventListener('click', onDocumentClick, true);

  // 页面卸载时标记
  window.addEventListener('beforeunload', () => {
    isTransitioning = true;
  });
})();