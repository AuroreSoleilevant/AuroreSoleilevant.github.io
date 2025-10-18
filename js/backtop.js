// 回到顶部按钮 + 评论按钮
//使用单一 rAF 驱动滚动节流
(function () {
  const ID = "back-to-top";
  const VISIBLE_CLASS = "visible";
  const POP_CLASS = "pop";
  const SHOW_THRESHOLD = 120; // 向下滚动多少像素后才显示的变量
  let btn = null;

  // 评论按钮相关
  let commentBtn = null;
  const COMMENT_ID = "jump-to-comments";
  const COMMENT_GAP = 12; // px，和 CSS var --comment-gap 对应
  let commentHandlersInstalled = false;

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
        // 如果评论按钮已安装，也重新检测它
        if (commentHandlersInstalled) checkCommentBtnVisibilitySimple();
      }, 600);
    });

    return btn;
  }

  // 判断页面是否有纵向滚动条（万一是横着的怎么办来着）
  function pageIsScrollable() {
    return document.documentElement.scrollHeight > window.innerHeight + 2;
  }

  // 页面级开关：在 body 或 html 上加 data-no-comment-button 或 class="no-comments" 可关闭评论按钮（推荐用class这个）
  function commentsDisabled() {
    try {
      const el = document.documentElement || document.body;
      return (
        (el && el.hasAttribute && el.hasAttribute("data-no-comment-button")) ||
        (document.body &&
          document.body.classList &&
          document.body.classList.contains("no-comments"))
      );
    } catch (e) {
      return false;
    }
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
          if (commentHandlersInstalled) checkCommentBtnVisibilitySimple();
          ticking = false;
        });
      }
    }
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  // 初始化绑定
  function init() {
    if (commentsDisabled()) {
      // 如果禁用评论按钮，就不安装任何评论相关逻辑
      installScrollHandler(); // 回到顶部仍然生效
      btn = createButton();
      updateBottomOffset();
      checkVisibility();
      return; // 直接返回，不装评论按钮
    }
    btn = createButton();
    updateBottomOffset();
    checkVisibility();

    installScrollHandler();

    window.addEventListener(
      "resize",
      () => {
        updateBottomOffset();
        checkVisibility();
        // 如果有评论按钮处理，也一起处理
        if (commentHandlersInstalled) {
          updateCommentOffset();
          checkCommentBtnVisibilitySimple();
        }
      },
      { passive: true }
    );

    window.addEventListener("pageshow", () => {
      // bfcache 恢复后重新计算并判断
      updateBottomOffset();
      checkVisibility();
      if (commentHandlersInstalled) {
        updateCommentOffset();
        checkCommentBtnVisibilitySimple();
      }
    });

    // 触摸处理
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
          if (commentHandlersInstalled) checkCommentBtnVisibilitySimple();
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
            if (commentHandlersInstalled) checkCommentBtnVisibilitySimple();
          });
          ro.observe(footer);
        } else {
          const mo = new MutationObserver((mutations, obs) => {
            const f = document.querySelector(".site-footer");
            if (f) {
              updateBottomOffset();
              checkVisibility();
              if (commentHandlersInstalled) {
                updateCommentOffset();
                checkCommentBtnVisibilitySimple();
              }
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
      // 忽略不影响核心逻辑的错误，大概真的是不影响吧？
    }

    // 如果页面未明确禁用评论按钮，则安装评论按钮处理（只在需要时创建）
    if (!commentsDisabled()) {
      installCommentHandlers();
    }
  }

  // DOM 就绪时初始化
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  /****************** 评论按钮实现，别问我为何要叠在一个js里 ******************/

  function createCommentButton() {
    if (commentBtn) return commentBtn;
    // 为了最大复用样式，给按钮两个 class
    commentBtn = document.createElement("button");
    commentBtn.id = COMMENT_ID;
    commentBtn.className = "back-to-top comment-button"; // 复用回到顶部样式
    commentBtn.title = "跳转到评论";
    commentBtn.setAttribute("aria-label", "跳转到评论");
    commentBtn.innerHTML =
      '<img class="backtop-icon" src="/icons/icon-Chat.svg" alt="" aria-hidden="true">';
    document.body.appendChild(commentBtn);

    // 点击事件：滚动到 #giscus-container
    commentBtn.addEventListener("click", (e) => {
      if (e && e.preventDefault) e.preventDefault();
      const target = document.getElementById("giscus-container");
      if (!target) return;
      // 滚动到评论容器（顶部对齐），平滑滚动
      try {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      } catch (err) {
        window.scrollTo({
          top: target.getBoundingClientRect().top + window.scrollY,
          behavior: "smooth",
        });
      }

      // 点击时 hide 并在延迟后重新检测（与回到顶部行为对齐）
      try {
        commentBtn.blur();
      } catch (e) {}
      hideCommentButton();
      setTimeout(() => {
        checkCommentBtnVisibilitySimple();
      }, 600);
    });

    // 同回到顶部按钮类似的 touch/keydown 无障碍处理
    commentBtn.addEventListener(
      "touchstart",
      () => {
        commentBtn.classList.remove("pop");
        void commentBtn.offsetWidth;
      },
      { passive: true }
    );
    commentBtn.addEventListener(
      "touchend",
      () => {
        try {
          commentBtn.blur();
        } catch (e) {}
        setTimeout(() => {
          checkCommentBtnVisibilitySimple();
        }, 50);
      },
      { passive: true }
    );
    commentBtn.addEventListener("keydown", (e) => {
      const key = e.key;
      if (key === "Enter" || key === " " || key === "Spacebar") {
        if (document.activeElement === commentBtn) {
          e.preventDefault();
          commentBtn.click();
        }
      }
    });

    return commentBtn;
  }

  // 复用回到顶部的显示/隐藏实现，保证行为一致（动画、opacity 恢复）
  function showCommentButton() {
    commentBtn = createCommentButton();
    updateCommentOffset();

    if (commentBtn.classList.contains(VISIBLE_CLASS)) {
      return;
    }
    commentBtn.classList.add(VISIBLE_CLASS);
    commentBtn.classList.remove(POP_CLASS);
    void commentBtn.offsetWidth;
    commentBtn.classList.add(POP_CLASS);
  }

  function hideCommentButton() {
    commentBtn = createCommentButton();
    if (!commentBtn.classList.contains(VISIBLE_CLASS)) return;
    commentBtn.classList.remove(VISIBLE_CLASS);
    commentBtn.classList.remove(POP_CLASS);
  }

  /* 计算并设置评论按钮底部偏移——与回到顶部按钮并列 */
  function updateCommentOffset() {
    createCommentButton();
    // 以回到顶部的底部 + 按钮高度 + gap 为基准
    const base =
      parseInt(
        getComputedStyle(document.documentElement).getPropertyValue(
          "--backtop-bottom"
        )
      ) || 96;
    const btnSize =
      parseInt(
        getComputedStyle(document.documentElement).getPropertyValue(
          "--backtop-size"
        )
      ) || 48;
    const gap =
      parseInt(
        getComputedStyle(document.documentElement).getPropertyValue(
          "--comment-gap"
        )
      ) || COMMENT_GAP;
    // 这里将通过内联样式设置 comment 按钮的 bottom，使其始终在 back-to-top 之上
    commentBtn.style.bottom = base + btnSize + gap + "px";
  }

  /* 检测评论按钮是否应可见：
     - 当页面可滚动并且滚动超过阈值时才显示（共享 SHOW_THRESHOLD）
     - 但如果评论区（或评论输入）已在视口中，则隐藏
  */
  function isElementInViewport(el, threshold = 0.15) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    // threshold 表示元素高度的多少比例进入视口就认为可见（这里用顶部/中间判断）
    return rect.top < vh * (1 - threshold) && rect.bottom > vh * threshold;
  }

  // 只做状态判断与最小操作（避免重复 add/remove 导致闪烁）
  function checkCommentBtnVisibilitySimple() {
    // 如果页面明确关闭评论按钮，则直接隐藏并返回
    if (commentsDisabled()) {
      if (commentBtn) {
        commentBtn.classList.remove(VISIBLE_CLASS);
        commentBtn.classList.remove(POP_CLASS);
      }
      return;
    }

    createCommentButton();

    // 如果页面不可滚动则隐藏
    if (!pageIsScrollable()) {
      hideCommentButton();
      return;
    }

    // 若 giscus 容器当前在视口内（或接近），则应隐藏评论按钮，说起来未来会单独做评论系统么
    const g = document.getElementById("giscus-container");
    const shouldHide = g && isElementInViewport(g, 0.25);

    if (shouldHide) {
      hideCommentButton();
      return;
    }

    // 否则应显示：只有当尚未可见时才触发 show（避免每次滚动都闪）
    if (!commentBtn.classList.contains(VISIBLE_CLASS)) {
      showCommentButton();
    }
  }

  /* 在已有的安装点中加入调用（只注册必要的事件） */
  function installCommentHandlers() {
    if (commentHandlersInstalled) return;
    commentHandlersInstalled = true;

    createCommentButton();
    updateCommentOffset();
    // 只注册 resize/pageshow/touchend fallback
    window.addEventListener(
      "resize",
      () => {
        updateCommentOffset();
        checkCommentBtnVisibilitySimple();
      },
      { passive: true }
    );
    window.addEventListener("pageshow", () => {
      updateCommentOffset();
      checkCommentBtnVisibilitySimple();
    });
  }
})();
