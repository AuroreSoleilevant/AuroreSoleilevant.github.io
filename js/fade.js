// 页面淡入淡出
(() => {
  const FADE_CLASS = 'loaded';
  let isTransitioning = false;

  function getTransitionMs(el) {
    try {
      const cs = getComputedStyle(el).transitionDuration || '';
      const first = cs.split(',')[0].trim();
      if (!first) return 400; // fallback 400ms
      return first.endsWith('ms') ? parseFloat(first) : parseFloat(first) * 1000;
    } catch (e) {
      return 400;
    }
  }

  function fadeIn() {
    const main = document.querySelector('main');
    if (!main) return;
    // 取消任何正在进行的标志（允许再次淡入）
    isTransitioning = false;

    // 先移除类以保证起始状态，然后强制重绘并在下一帧添加类，触发过渡
    main.classList.remove(FADE_CLASS);
    // 强制重绘（我感觉是个双保险）
    void main.offsetWidth;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        main.classList.add(FADE_CLASS);
      });
    });
  }

  // 处理点击链接：仅拦截“应当淡出再跳转”的内部导航
  function onDocumentClick(e) {
    const a = e.target.closest('a');
    if (!a) return;

    // 取 href 原始值（避免空点击）
    const href = a.getAttribute('href');
    if (!href) return;

    // 不处理下面这些情况（保留默认行为）
    if (a.target === '_blank' || a.hasAttribute('download')) return;
    if (href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) return;
    if (href.startsWith('#')) return; // 页面内锚点

    // 解析为绝对 URL
    let url;
    try {
      url = new URL(href, location.href);
    } catch (err) {
      return; // 无效 URL，放行
    }

    // 只拦截同源导航（使得站内导航）
    if (url.origin !== location.origin) return;

    // 如果只是改变 hash（在同一 pathname 下）则不拦截
    if (url.pathname === location.pathname && url.hash && url.hash !== '') return;

    // 拦截并淡出
    e.preventDefault();

    // 防止重复点击/并发跳转
    if (isTransitioning) return;
    isTransitioning = true;

    const main = document.querySelector('main');
    // 如果没有 main，直接跳转（无淡出）
    if (!main) {
      window.location.href = url.href;
      return;
    }

    // 触发淡出（顺便移除 loaded 类）
    main.classList.remove(FADE_CLASS);

    // 计算等待时间
    const wait = Math.max(getTransitionMs(main) + 30, 80); // 至少 80ms 以防极短动画
    setTimeout(() => {
      // 最终导航
      window.location.href = url.href;
    }, wait);
  }

  // 初始化：绑定事件
  document.addEventListener('DOMContentLoaded', () => {
    fadeIn();
  });

  // pageshow 在浏览器前进/后退并从 bfcache 恢复时会触发
  window.addEventListener('pageshow', (ev) => {
    // 无论是否为缓存恢复，都尝试淡入以保证一致性
    fadeIn();
  });

  // 使用事件委托，省去为每个 <a> 单独绑定（用来适配后插入的链接）
  document.addEventListener('click', onDocumentClick, true);

  // 在页面卸载时清理
  window.addEventListener('beforeunload', () => {
    // 标记正在离开，防止某些事件乱触发，互联网的事情天知道
    isTransitioning = true;
  });
})();