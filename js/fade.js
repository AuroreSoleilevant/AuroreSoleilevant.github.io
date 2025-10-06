(() => {
  // ----- 配置常量 -----
  const FADE_CLASS = 'loaded';
  const FOOTER_URL = '/outil/footer.inc/index.html'; // 路径
  const PLACEHOLDER_ID = 'footer-placeholder';
  let isTransitioning = false;

  // ----- 工具函数 -----
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

  // ----- footer 动画控制（确保每次 enter 都被触发） -----
  // 可接受具体元素参数
  function prepareFooterInitial(el) {
    const f = el || getFooter();
    if (!f) return;
    // 强制进入初始状态：移除可能存在的进入/退出类，再加 pre-enter
    f.classList.remove('slide-down', 'entered');
    f.classList.add('pre-enter');
    // 清除可能的内联 transform（避免干扰），并强制重排
    f.style.transform = '';
    void f.offsetWidth;
  }

  function footerEnter(el) {
    const f = el || getFooter();
    if (!f) return;
    // 确保处于预进入态
    f.classList.remove('slide-down', 'entered');
    f.classList.add('pre-enter');
    void f.offsetWidth;
    // 两次 rAF 保证 transition 会被浏览器识别
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        f.classList.add('entered');
        const t = Math.max(getTransitionMs(f), 60);
        // 在动画开始后把 pre-enter 清掉（留点余量）
        setTimeout(() => f.classList.remove('pre-enter'), t + 20);
      });
    });
  }

  function footerExit(el) {
    const f = el || getFooter();
    if (!f) return;
    // 直接从任何状态进入 slide-down（退出）
    f.classList.remove('pre-enter', 'entered');
    void f.offsetWidth;
    f.classList.add('slide-down');
  }

  // ----- main 淡入（可靠触发） -----
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

  // ----- 点击处理：统一淡出行为并触发 footer exit -----
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

  // ----- footer 插入后的处理：等待图片加载并派发事件 -----
  function notifyFooterInserted(footerEl) {
    if (!footerEl) {
      document.dispatchEvent(new CustomEvent('footer:inserted', { detail: null }));
      return;
    }

    // 先把 footer 设为预进入初始态
    footerEl.classList.remove('entered', 'slide-down');
    footerEl.classList.add('pre-enter');
    footerEl.style.transform = '';
    // 强制重排，保证后续添加 entered 能被识别为 transition
    void footerEl.offsetWidth;

    const imgs = footerEl.querySelectorAll('img');
    const loads = imgs.length ? Array.from(imgs).map(img => img.complete ? Promise.resolve() : new Promise(r => img.addEventListener('load', r, { once: true }))) : [];
    Promise.all(loads).then(() => {
      // 确保样式表生效
      setTimeout(() => {
        document.dispatchEvent(new CustomEvent('footer:inserted', { detail: { footer: footerEl } }));
      }, 20);
    }).catch(() => {
      setTimeout(() => {
        document.dispatchEvent(new CustomEvent('footer:inserted', { detail: { footer: footerEl } }));
      }, 60);
    });
  }

  // ----- 避免被重复插入或空覆盖 -----
  let _fetchRetries = 0;
  const _maxRetries = 4;
  function fetchAndInsertFooter() {
    const placeholder = document.getElementById(PLACEHOLDER_ID);
    if (!placeholder) {
      console.warn('fetchAndInsertFooter: 未找到 #' + PLACEHOLDER_ID);
      return;
    }

    // 如果占位里已经有 .site-footer，说明页面可能被服务器端渲染，此时直接触发动画初始化
    const existing = placeholder.querySelector('.site-footer');
    if (existing) {
      // 确保初始化状态并通知（notify 内部会派发事件）
      notifyFooterInserted(existing);
      return;
    }

    fetch(FOOTER_URL, { cache: 'no-cache' })
      .then(res => {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.text();
      })
      .then(html => {
        if (!html || !html.trim()) throw new Error('返回内容为空');
        // 只有在 placeholder 仍存在且为空时才插入（避免覆盖别的脚本已插入的内容）
        const currPlaceholder = document.getElementById(PLACEHOLDER_ID);
        if (!currPlaceholder) {
          console.warn('fetchAndInsertFooter: placeholder 在插入前被移除，放弃插入。');
          return;
        }
        if (currPlaceholder.querySelector('.site-footer')) {
          // 已被别处插入，直接通知
          notifyFooterInserted(currPlaceholder.querySelector('.site-footer'));
          return;
        }

        currPlaceholder.innerHTML = html;
        const footerEl = currPlaceholder.querySelector('.site-footer');
        notifyFooterInserted(footerEl);

        // 观察：如果插入后又被清空/移除，尝试少量重试（退避）
        const mo = new MutationObserver((mutations, obs) => {
          const now = currPlaceholder.innerHTML || '';
          if (!now.trim()) {
            obs.disconnect();
            if (_fetchRetries < _maxRetries) {
              _fetchRetries++;
              const delay = 120 * _fetchRetries;
              console.warn('fetchAndInsertFooter: 插入后内容被清空，' + _fetchRetries + ' 次重试，' + delay + 'ms 后再次尝试。');
              setTimeout(fetchAndInsertFooter, delay);
            } else {
              console.error('fetchAndInsertFooter: 多次重试失败，停止自动恢复。');
            }
          }
        });
        mo.observe(currPlaceholder, { childList: true, subtree: true });
      })
      .catch(err => {
        console.error('fetchAndInsertFooter 错误：', err);
        if (_fetchRetries < _maxRetries) {
          _fetchRetries++;
          setTimeout(fetchAndInsertFooter, 200 * _fetchRetries);
        }
      });
  }

  // ----- 在 IIFE 内监听自定义事件 footer:inserted -----
  // 当 fetch 插入 footer 后会派发此事件，IIFE 内部会在收到时触发入场动画
  document.addEventListener('footer:inserted', (ev) => {
    // 优先使用事件里传来的 footer 元素，以防页面上有多个 footer 或 querySelector 返回旧元素
    const el = ev && ev.detail && ev.detail.footer ? ev.detail.footer : null;
    // 重新准备初始状态并触发 enter（与 DOMContentLoaded 时一致）
    prepareFooterInitial(el);
    // 通过 rAF 调用 enter（确保 transition 被正确触发）
    requestAnimationFrame(() => footerEnter(el));
  });

  // ----- 初始化绑定 -----
  document.addEventListener('DOMContentLoaded', () => {
    // 当 DOM 准备好时（确保 placeholder 存在或不）先做主页面淡入
    prepareFooterInitial();
    requestAnimationFrame(() => {
      fadeInMain();
      // 仅当 footer 已在 DOM 中（例如服务器端已插入）时才触发 enter
      const f = getFooter();
      if (f) footerEnter(f);
    });

    // 触发 footer 的 fetch & 插入
    fetchAndInsertFooter();
  });

  // pageshow: 包含 bfcache 恢复的情形，确保 enter 能触发
  window.addEventListener('pageshow', (ev) => {
    isTransitioning = false;

    fadeInMain();

    const f = getFooter();
    if (f) {
      f.classList.remove('slide-down');
      // 重新准备并触发
      prepareFooterInitial(f);
      requestAnimationFrame(() => footerEnter(f));
    } else {
      // 仍准备一次全局状态（以防占位里随后插入）
      prepareFooterInitial();
    }
  });

  // 点击拦截（页面内部导航过渡）
  document.addEventListener('click', onDocumentClick, true);

  // 离开页面时阻止重复触发
  window.addEventListener('beforeunload', () => {
    isTransitioning = true;
  });

  // 导出
  window.__fetchAndInsertFooter = fetchAndInsertFooter;
})();