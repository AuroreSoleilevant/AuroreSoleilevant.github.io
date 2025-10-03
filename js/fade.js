// 淡入淡出
(() => {
  const FADE_CLASS = 'loaded';
  let isTransitioning = false;

  // --- 工具函数 ---
  function getFooter() {
    return document.querySelector('.site-footer');
  }

  function getMain() {
    return document.querySelector('main');
  }

  // 获取元素 transition 的第一个持续时间（ms），有 fallback
  function getTransitionMs(el) {
    try {
      if (!el) return 400;
      const cs = getComputedStyle(el).transitionDuration || '';
      const first = cs.split(',')[0].trim();
      if (!first) return 400;
      return first.endsWith('ms') ? parseFloat(first) : parseFloat(first) * 1000;
    } catch (e) {
      return 400;
    }
  }

  // --- footer 动画控制（确保每次 enter 都被触发） ---
  function prepareFooterInitial() {
    const f = getFooter();
    if (!f) return;
    // 确保处于 "下方初始" 状态，清除其他类
    f.classList.remove('slide-down', 'entered');
    f.classList.add('pre-enter');
    // 强制重绘，确保浏览器把 pre-enter 视为当前状态
    void f.offsetWidth;
  }

  function footerEnter() {
    const f = getFooter();
    if (!f) return;
    // 从下方进入：先确保处于 pre-enter
    f.classList.remove('slide-down', 'entered');
    f.classList.add('pre-enter');
    // 强制重绘以固定初始状态
    void f.offsetWidth;

    // 双 rAF 保证在所有浏览器中稳定触发 transition
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        f.classList.add('entered');
        // 清理 pre-enter after the transition duration (keeps DOM classes tidy)
        const t = Math.max(getTransitionMs(f), 60);
        setTimeout(() => f.classList.remove('pre-enter'), t + 20);
      });
    });
  }

  function footerExit() {
    const f = getFooter();
    if (!f) return;
    // 从当前状态滑出到底部（保证移除进入类）
    f.classList.remove('pre-enter', 'entered');
    // 强制重绘再加 slide-down，确保 transition 正常触发
    void f.offsetWidth;
    f.classList.add('slide-down');
  }

  function footerRestore() {
    const f = getFooter();
    if (!f) return;
    f.classList.remove('slide-down', 'pre-enter', 'entered');
    f.style.transform = '';
  }

  // --- main 淡入（可靠触发） ---
  function fadeInMain() {
    const main = getMain();
    if (!main) return;
    isTransitioning = false;
    main.classList.remove(FADE_CLASS);
    void main.offsetWidth; // force reflow
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        main.classList.add(FADE_CLASS);
      });
    });
  }

  // --- 点击处理：统一淡出行为并触发 footer exit ---
  function onDocumentClick(e) {
    const a = e.target.closest('a');
    if (!a) return;

    const href = a.getAttribute('href');
    if (!href) return;

    // 不处理：新标签 / 下载 / mailto / tel / javascript / 锚点
    if (a.target === '_blank' || a.hasAttribute('download')) return;
    if (href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) return;
    if (href.startsWith('#')) return;

    // 解析 URL，确保为站内同源链接
    let url;
    try {
      url = new URL(href, location.href);
    } catch {
      return;
    }
    if (url.origin !== location.origin) return;
    // 同页 hash 的情况不拦截
    if (url.pathname === location.pathname && url.hash && url.hash !== '') return;

    // 拦截导航
    e.preventDefault();
    if (isTransitioning) return;
    isTransitioning = true;

    const main = getMain();
    if (!main) {
      // 没有 main，直接跳转
      window.location.href = url.href;
      return;
    }

    // 主体淡出
    main.classList.remove(FADE_CLASS);

    // footer 统一向下退出（并行进行）
    footerExit();

    // 等待动画完成后跳转（取 main 与 footer 最大的 transition）
    const mainWait = getTransitionMs(main);
    const footerEl = getFooter();
    const footerWait = footerEl ? getTransitionMs(footerEl) : 0;
    const wait = Math.max(mainWait, footerWait) + 40;

    setTimeout(() => {
      window.location.href = url.href;
    }, wait);
  }

  // --- 初始化绑定 ---
  // DOMContentLoaded: 页面初次加载，准备 footer 初始状态并淡入 main
  document.addEventListener('DOMContentLoaded', () => {
    prepareFooterInitial();
    requestAnimationFrame(() => {
      fadeInMain();
      footerEnter();
    });
  });

  // pageshow: 包含 bfcache 恢复的情形，确保 enter 能触发
  window.addEventListener('pageshow', (ev) => {
    isTransitioning = false;

    fadeInMain();

    const f = getFooter();
    if (f) {
      f.classList.remove('slide-down');
    }
    prepareFooterInitial();
    requestAnimationFrame(() => footerEnter());
  });

  document.addEventListener('click', onDocumentClick, true);

  window.addEventListener('beforeunload', () => {
    isTransitioning = true;
  });
})();