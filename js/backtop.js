// 回到顶部按钮
(function () {
  const ID = "back-to-top";
  const VISIBLE_CLASS = "visible";
  const POP_CLASS = "pop";
  const SHOW_THRESHOLD = 120; // 向下滚动多少像素后才显示的变量
  let btn = null;

  // 创建按钮（如果 HTML 中不存在），并在创建时绑定点击行为
  function createButton() {
    if (btn) return btn;
    btn = document.createElement("button");
    btn.id = ID;
    btn.className = "back-to-top";
    btn.title = "回到顶部";
    btn.setAttribute("aria-label", "回到顶部");
    btn.innerHTML =
      '<img class="backtop-icon" src="/icons/icon-top.svg" alt="" aria-hidden="true">';
    // 插入 body 末尾
    document.body.appendChild(btn);

    // 绑定点击
    btn.addEventListener("click", (e) => {
      if (e && e.preventDefault) e.preventDefault();
      try {
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch (err) {
        window.scrollTo(0, 0);
      }
      // 关键：blur + 隐藏 + 延迟重新检测
      try {
        btn.blur();
      } catch (e) {}
      hideButton();
      setTimeout(() => {
        checkVisibility();
      }, 600);
    });

    return btn;
  }

  // 判断页面是否有纵向滚动条
  function pageIsScrollable() {
    return document.documentElement.scrollHeight > window.innerHeight + 2;
  }

  // 更新底部 offset
  function updateBottomOffset() {
    const footer = document.querySelector(".site-footer");
    const current =
      parseInt(
        getComputedStyle(document.documentElement).getPropertyValue(
          "--backtop-bottom"
        )
      ) || 96;
    if (footer) {
      const fh =
        footer.offsetHeight ||
        Math.round(footer.getBoundingClientRect().height) ||
        0;
      const gap = 16; // 按钮与 footer 之间的间距变量
      const newBottom = fh + gap;
      document.documentElement.style.setProperty(
        "--backtop-bottom",
        `${newBottom}px`
      );
    } else {
      document.documentElement.style.setProperty(
        "--backtop-bottom",
        `${current}px`
      );
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
    // 触发 pop 动画
    btn.classList.remove(POP_CLASS);
    // 强制重绘，然后加 pop
    void btn.offsetWidth;
    btn.classList.add(POP_CLASS);
  }

  function hideButton() {
    btn = createButton();
    if (!btn.classList.contains(VISIBLE_CLASS)) return;
    btn.classList.remove(VISIBLE_CLASS);
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

  // 键盘可访问性（Enter/Space 激活）
  function onKey(e) {
    const key = e.key;
    if (key === "Enter" || key === " " || key === "Spacebar") {
      if (document.activeElement === btn) {
        e.preventDefault();
        // 直接调用 createButton 时绑定的 click 行为更接近初始实现
        btn.click();
      }
    }
  }

  // rAF 驱动的 scroll throttle
  function installScrollHandler() {
    let ticking = false;
    function onScroll() {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(() => {
          checkVisibility();
          ticking = false;
        });
      }
    }
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  // 初始化绑定
  function init() {
    btn = createButton();
    updateBottomOffset();
    checkVisibility();

    installScrollHandler();

    window.addEventListener(
      "resize",
      () => {
        updateBottomOffset();
        checkVisibility();
      },
      { passive: true }
    );

    window.addEventListener("pageshow", () => {
      // bfcache 恢复后重新计算并判断
      updateBottomOffset();
      checkVisibility();
    });

    // 触摸处理 — 保留初始版本行为：touchstart 移除 pop，touchend blur + 短延迟 hide/check
    btn.addEventListener(
      "touchstart",
      () => {
        btn.classList.remove("pop");
        void btn.offsetWidth;
      },
      { passive: true }
    );
    btn.addEventListener(
      "touchend",
      () => {
        try {
          btn.blur();
        } catch (e) {}
        setTimeout(() => {
          hideButton();
          checkVisibility();
        }, 50);
      },
      { passive: true }
    );

    // 键盘可访问性
    try {
      btn.removeEventListener("keydown", onKey);
    } catch (e) {}
    btn.addEventListener("keydown", onKey);

    // 若浏览器支持 ResizeObserver，监听 footer 大小变化以即时更新偏移
    try {
      if ("ResizeObserver" in window) {
        const footer = document.querySelector(".site-footer");
        if (footer) {
          const ro = new ResizeObserver(() => {
            updateBottomOffset();
            checkVisibility();
          });
          ro.observe(footer);
        } else {
          const mo = new MutationObserver((mutations, obs) => {
            const f = document.querySelector(".site-footer");
            if (f) {
              updateBottomOffset();
              checkVisibility();
              if ("ResizeObserver" in window) {
                const ro = new ResizeObserver(() => {
                  updateBottomOffset();
                  checkVisibility();
                });
                ro.observe(f);
              }
              obs.disconnect();
            }
          });
          mo.observe(document.body, { childList: true, subtree: true });
        }
      }
    } catch (e) {
      // 忽略不影响核心逻辑的错误
    }
  }

  // DOM 就绪时初始化
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
