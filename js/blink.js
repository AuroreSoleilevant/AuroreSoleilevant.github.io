// 顶栏导航闪烁
(function () {
  const defaultDuration = 2400; // 闪烁周期 ms
  const fadeOutDuration = 800; // 离开后平滑回到1的时间 ms
  const minOpacity = 0.05;
  const maxOpacity = 1;

  // 状态集合：Element -> { hovering, startAt, fadeStart, fadeFrom }
  const states = new Map();
  let rafId = null;

  // 计算 hover 时刻的 opacity
  function calcHoverOpacity(state, now) {
    // 如果没有 startAt（虽说不应该），返回 1 作为 fallback
    if (!state || !state.startAt) return 1;
    const elapsed = now - state.startAt;
    // 正模运算确保负值安全（真的可能出现吗？）
    const t =
      (((elapsed % defaultDuration) + defaultDuration) % defaultDuration) /
      defaultDuration;
    // 正弦映射（从 minOpacity 到 maxOpacity）
    return (
      minOpacity +
      (maxOpacity - minOpacity) *
        (0.5 * (1 + Math.sin(Math.PI * 2 * t - Math.PI / 2)))
    );
  }

  // 启动共享 RAF（如果尚未启动）
  function startLoop() {
    if (rafId != null) return;
    rafId = requestAnimationFrame(loop);
  }

  // 停止 RAF（当没有需要动画的元素时）
  function stopLoop() {
    if (rafId == null) return;
    cancelAnimationFrame(rafId);
    rafId = null;
  }

  // 主循环：更新所有元素的 opacity 状态
  function loop(now) {
    let needKeep = false; // 是否还需要继续动画
    for (const [el, state] of states.entries()) {
      try {
        // 确保元素初始 opacity （避免某些很奇怪的 CSS 未设置）
        if (!el.style.opacity) el.style.opacity = "1";

        if (state.hovering) {
          // 正在 hover：根据 startAt 计算周期性 opacity
          const o = calcHoverOpacity(state, now);
          el.style.opacity = String(o);
          needKeep = true; // hover 元素需要持续动画
        } else if (state.fadeStart != null) {
          // 刚离开：从 fadeFrom 平滑回到 1
          const elapsed = now - state.fadeStart;
          const t = Math.min(elapsed / fadeOutDuration, 1);
          const o = state.fadeFrom + (1 - state.fadeFrom) * t;
          el.style.opacity = String(o);
          // 若未完成则继续循环
          if (t < 1) {
            needKeep = true;
          } else {
            // 完成后确保恢复为 1 并清理 fade 状态
            el.style.opacity = "1";
            state.fadeStart = null;
            state.fadeFrom = null;
          }
        } else {
          // 既不 hover 也不在 fade 中：确保为 1（无动画）
          el.style.opacity = "1";
        }
      } catch (e) {
        // 单个元素出错不影响其他元素
      }
    }

    if (needKeep) {
      rafId = requestAnimationFrame(loop);
    } else {
      rafId = null;
    }
  }

  // 鼠标/指针进入
  function handleEnter(el) {
    let state = states.get(el);
    const now = performance.now();
    if (!state) {
      state = {
        hovering: false,
        startAt: null,
        fadeStart: null,
        fadeFrom: null,
      };
      states.set(el, state);
    }
    // 设置 hover 状态：重置周期起点（和原实现一致）
    state.hovering = true;
    state.startAt = now;
    state.fadeStart = null;
    state.fadeFrom = null;
    startLoop();
  }

  // 鼠标/指针离开
  function handleLeave(el) {
    const state = states.get(el);
    const now = performance.now();
    if (!state) return;
    // 记录从何处开始平滑回 1：使用 calcHoverOpacity，根据刚才的 startAt 得到当前 opacity
    const currentOpacity = calcHoverOpacity(state, now);
    state.hovering = false;
    state.fadeStart = now;
    state.fadeFrom = currentOpacity;
    // 启动循环以处理 fadeOut（若尚未启动）
    startLoop();
  }

  // 初始化：为 .nav-item 注册事件（幂等）
  function initNavBlink() {
    const items = Array.from(document.querySelectorAll(".nav-item"));
    if (!items.length) return;

    items.forEach((elem) => {
      // 幂等：若已绑定过则跳过
      if (elem.dataset._navBlinkHandled === "1") return;
      elem.dataset._navBlinkHandled = "1";

      // 确保初始样式（避免某些一样很奇怪的 CSS 未显式重置）
      if (!elem.style.opacity) elem.style.opacity = "1";

      // 使用 pointer 事件兼容 touch 与鼠标行为（pointerenter/leave 行为类似 mouseenter）
      elem.addEventListener("pointerenter", () => handleEnter(elem));
      elem.addEventListener("pointerleave", () => handleLeave(elem));

      // 用来防止古代浏览器出现什么问题
      // 只有在指针事件不可用时才会触发这些（browser 会同时支持 pointer events 大多数场景）
      elem.addEventListener("mouseenter", () => handleEnter(elem));
      elem.addEventListener("mouseleave", () => handleLeave(elem));
    });
  }

  // 在 header:inserted 时初始化（支持动态插入）
  document.addEventListener("header:inserted", () => {
    initNavBlink();
  });

  // 页面已有 nav-item 时尽早初始化
  if (document.querySelector(".nav-item")) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initNavBlink);
    } else {
      initNavBlink();
    }
  }

  // 如果 header 被移除/替换，确保释放不再存在的元素状态（避免内存泄漏）
  // 通过定期清理 states 中已不在文档中的元素
  function cleanupStates() {
    for (const [el] of states.entries()) {
      if (!document.contains(el)) {
        states.delete(el);
      }
    }
    // 如果没有需要动画的元素了，停止 RAF
    let anyActive = false;
    for (const state of states.values()) {
      if (state.hovering || state.fadeStart != null) {
        anyActive = true;
        break;
      }
    }
    if (!anyActive) stopLoop();
  }
  // 轻量低频周期性清理
  setInterval(cleanupStates, 5000);
})();
