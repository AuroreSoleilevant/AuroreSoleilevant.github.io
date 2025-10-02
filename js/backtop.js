// backtop.js — 自动创建并控制回到顶部按钮
(function () {
  const ID = 'back-to-top';
  const VISIBLE_CLASS = 'visible';
  const POP_CLASS = 'pop';
  const SHOW_THRESHOLD = 120; // 向下滚动多少像素后才显示（可改）
  let btn = document.getElementById(ID);

  // 创建按钮（如果 HTML 中不存在）
  function createButton() {
    if (btn) return btn;
    btn = document.createElement('button');
    btn.id = ID;
    btn.className = 'back-to-top';
    btn.title = '回到顶部';
    btn.setAttribute('aria-label', '回到顶部');
    btn.innerHTML = '<span>^</span>';
    // 插入 body 末尾
    document.body.appendChild(btn);
    btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    btn.blur(); // 移除焦点，恢复普通状态
    });
    return btn;
  }

  // 判断页面是否有纵向滚动条（可以滚动）
  function pageIsScrollable() {
    return document.documentElement.scrollHeight > window.innerHeight + 2;
  }

  // 更新底部 offset（避让 footer）
  function updateBottomOffset() {
    const footer = document.querySelector('.site-footer');
    let offset = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--backtop-bottom')) || 96;
    if (footer) {
      const fh = footer.offsetHeight || Math.round(footer.getBoundingClientRect().height) || 0;
      const gap = 16; // 按钮与 footer 之间的间距（可调）
      const newBottom = fh + gap;
      document.documentElement.style.setProperty('--backtop-bottom', `${newBottom}px`);
    } else {
      // fallback 保持默认或先前设置
      document.documentElement.style.setProperty('--backtop-bottom', `${offset}px`);
    }
  }

  // 显示 / 隐藏 控制（带 pop 动画）
  function showButton() {
    btn = createButton();
    updateBottomOffset();

    if (btn.classList.contains(VISIBLE_CLASS)) {
      // 已可见，无需重复触发 pop
      return;
    }
    btn.classList.add(VISIBLE_CLASS);
    // 触发 pop 动画（重新触发时先移除再添加以确保动画执行）
    btn.classList.remove(POP_CLASS);
    // 强制重绘，然后加 pop
    void btn.offsetWidth;
    btn.classList.add(POP_CLASS);
  }

  function hideButton() {
    btn = createButton();
    if (!btn.classList.contains(VISIBLE_CLASS)) return;
    btn.classList.remove(VISIBLE_CLASS);
    // pop 类保留或移除均可
    btn.classList.remove(POP_CLASS);
  }

  // 根据滚动与页面可滚动性判断是否显示
  function checkVisibility() {
    btn = createButton();
    if (!pageIsScrollable()) {
      hideButton();
      return;
    }
    if (window.scrollY > SHOW_THRESHOLD) {
      showButton();
    } else {
      hideButton();
    }
  }

  // 点击回到顶部（平滑滚动）
  function onClick(e) {
    e.preventDefault();
    // 平滑回顶
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      window.scrollTo(0, 0);
    }
    // 隐藏按钮，防止重复点击；短延迟后刷新可见性（等平滑滚动或用户已在顶）
    hideButton();
    setTimeout(() => {
      checkVisibility();
    }, 600); // 若你用较长 smooth 时间可加大
  }

  // 键盘可访问性（Enter/Space 激活）
  function onKey(e) {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
      if (document.activeElement === btn) {
        e.preventDefault();
        onClick(e);
      }
    }
  }

  // 初始化绑定
  function init() {
    createButton();
    updateBottomOffset();
    checkVisibility();

    window.addEventListener('scroll', throttle(checkVisibility, 120), { passive: true });
    window.addEventListener('resize', throttle(() => {
      updateBottomOffset();
      checkVisibility();
    }, 200));
    window.addEventListener('pageshow', () => {
      // bfcache 恢复后重新计算并判断
      updateBottomOffset();
      checkVisibility();
    });

    btn.addEventListener('click', onClick);
    btn.addEventListener('keydown', onKey);
  }

  // 简单防抖/节流函数
  function throttle(fn, wait) {
    let last = 0;
    let timeout = null;
    return function (...args) {
      const now = Date.now();
      const remaining = wait - (now - last);
      if (remaining <= 0) {
        if (timeout) { clearTimeout(timeout); timeout = null; }
        last = now;
        fn.apply(this, args);
      } else if (!timeout) {
        timeout = setTimeout(() => {
          last = Date.now();
          timeout = null;
          fn.apply(this, args);
        }, remaining);
      }
    };
  }

  // DOM 就绪时初始化（若 script 放在 body 末尾也可直接调用）
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();