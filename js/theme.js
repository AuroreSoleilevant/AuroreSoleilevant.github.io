// 普通页面明暗主题：系统偏好 + 当前标签页会话选择
(() => {
  if (window.__SPICA_THEME_INSTALLED) return;
  window.__SPICA_THEME_INSTALLED = true;

  const STORAGE_KEY = "spica-theme-choice";
  const DARK_QUERY = "(prefers-color-scheme: dark)";
  const MOBILE_QUERY = "(max-width: 768px)";
  const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
  const TRANSITION_FALLBACK_MS = 480;
  const colorSchemeMedia =
    typeof window.matchMedia === "function"
      ? window.matchMedia(DARK_QUERY)
      : null;
  const reducedMotionMedia =
    typeof window.matchMedia === "function"
      ? window.matchMedia(REDUCED_MOTION_QUERY)
      : null;
  const mobileLayoutMedia =
    typeof window.matchMedia === "function"
      ? window.matchMedia(MOBILE_QUERY)
      : null;
  let button = null;
  let transitionCleanup = null;
  let transitionActive = false;
  let restoreButtonFocus = false;
  let baseStyleReady = false;

  function readStoredTheme() {
    try {
      const value = sessionStorage.getItem(STORAGE_KEY);
      return value === "light" || value === "dark" ? value : null;
    } catch (e) {
      return null;
    }
  }

  function storeTheme(theme) {
    try {
      sessionStorage.setItem(STORAGE_KEY, theme);
    } catch (e) {
      /* 存储被禁用时，本页切换仍然有效 */
    }
  }

  function clearStoredTheme() {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      /* 存储不可用时无需清理 */
    }
  }

  function systemTheme() {
    return colorSchemeMedia && colorSchemeMedia.matches ? "dark" : "light";
  }

  function usesMainFade() {
    return mobileLayoutMedia
      ? mobileLayoutMedia.matches
      : window.innerWidth <= 768;
  }

  function updateButton(theme) {
    if (!button || button.dataset.theme === theme) return;
    const isDark = theme === "dark";
    const action = isDark ? "切换为日间模式" : "切换为夜间模式";
    button.setAttribute("aria-label", action);
    button.setAttribute("aria-pressed", String(isDark));
    button.title = action;
    button.dataset.theme = theme;
  }

  function setButtonBusy(busy) {
    if (!button) return;
    button.disabled = busy;
    if (busy) {
      button.setAttribute("aria-busy", "true");
    } else {
      button.removeAttribute("aria-busy");
    }
  }

  function clearTransitionState() {
    if (!transitionActive) return;
    transitionActive = false;

    const root = document.documentElement;
    const shouldRestoreFocus = restoreButtonFocus;
    restoreButtonFocus = false;
    if (transitionCleanup) {
      const cleanup = transitionCleanup;
      transitionCleanup = null;
      cleanup();
    }
    root.classList.remove("is-theme-transitioning");
    setButtonBusy(false);
    if (shouldRestoreFocus && button && button.isConnected) {
      try {
        button.focus({ preventScroll: true });
      } catch (e) {
        button.focus();
      }
    }
  }

  function commitTheme(nextTheme) {
    const root = document.documentElement;
    const colorScheme = `only ${nextTheme}`;
    if (root.dataset.theme !== nextTheme) root.dataset.theme = nextTheme;
    if (root.style.colorScheme !== colorScheme) {
      root.style.colorScheme = colorScheme;
    }
    updateButton(nextTheme);
    document.dispatchEvent(
      new CustomEvent("theme:changed", {
        detail: { theme: nextTheme },
      })
    );
  }

  function applyTheme(theme, animate = false) {
    const nextTheme = theme === "dark" ? "dark" : "light";
    const root = document.documentElement;
    const currentTheme = root.dataset.theme === "dark" ? "dark" : "light";
    const shouldAnimate =
      animate === true &&
      currentTheme !== nextTheme &&
      document.body &&
      !(reducedMotionMedia && reducedMotionMedia.matches);

    clearTransitionState();
    if (!shouldAnimate) {
      commitTheme(nextTheme);
      return;
    }

    const body = document.body;
    transitionActive = true;
    root.classList.add("is-theme-transitioning");
    restoreButtonFocus = button === document.activeElement;
    setButtonBusy(true);

    /* 先让浏览器建立旧主题的过渡起点，再提交新主题颜色。 */
    void body.offsetWidth;

    let finished = false;
    let fallbackTimer = null;

    function finishTransition() {
      if (finished) return;
      finished = true;
      clearTransitionState();
    }

    function onTransitionDone(event) {
      if (event.target === body && event.propertyName === "background-color") {
        finishTransition();
      }
    }

    body.addEventListener("transitionend", onTransitionDone);
    body.addEventListener("transitioncancel", onTransitionDone);
    fallbackTimer = window.setTimeout(
      finishTransition,
      TRANSITION_FALLBACK_MS
    );
    transitionCleanup = () => {
      body.removeEventListener("transitionend", onTransitionDone);
      body.removeEventListener("transitioncancel", onTransitionDone);
      if (fallbackTimer !== null) window.clearTimeout(fallbackTimer);
    };

    commitTheme(nextTheme);
  }

  function revealButtonWhenReady() {
    const layoutAnchor = usesMainFade()
      ? document.querySelector("main")
      : document.querySelector(".site-header");
    if (
      button &&
      baseStyleReady &&
      layoutAnchor
    ) {
      button.classList.add("is-ready");
      button.style.removeProperty("position");
      button.style.removeProperty("visibility");
    }
  }

  function watchBaseStyle() {
    const stylesheet = document.getElementById("spica-base-style");
    if (!stylesheet) return;
    if (stylesheet.sheet) {
      baseStyleReady = true;
      revealButtonWhenReady();
      return;
    }
    stylesheet.addEventListener(
      "load",
      () => {
        baseStyleReady = true;
        revealButtonWhenReady();
      },
      { once: true }
    );
  }

  function createButton() {
    if (button || !document.body) return button;
    button = document.createElement("button");
    button.id = "theme-toggle";
    button.className = "theme-toggle";
    button.type = "button";
    /* CSS 尚未加载时也保持不可见且脱离正文流，防止原生按钮闪现。 */
    button.style.position = "fixed";
    button.style.visibility = "hidden";
    button.innerHTML =
      '<span class="theme-toggle__moon" aria-hidden="true">☾</span>' +
      '<span class="theme-toggle__sun" aria-hidden="true">☀</span>';

    button.addEventListener("click", (event) => {
      const current =
        document.documentElement.dataset.theme === "dark" ? "dark" : "light";
      const nextTheme = current === "dark" ? "light" : "dark";
      storeTheme(nextTheme);
      if (event.detail > 0) button.blur();
      applyTheme(nextTheme, true);
    });

    const host = usesMainFade()
      ? document.querySelector("main") || document.body
      : document.body;
    host.appendChild(button);
    updateButton(
      document.documentElement.dataset.theme === "dark" ? "dark" : "light"
    );
    revealButtonWhenReady();
    return button;
  }

  function syncFromPreference() {
    applyTheme(readStoredTheme() || systemTheme(), false);
  }

  function onSystemThemeChange() {
    // 用户主动改变系统主题时，以新的系统选择为准，并恢复自动跟随。
    clearStoredTheme();
    applyTheme(systemTheme(), true);
  }

  if (colorSchemeMedia) {
    if (typeof colorSchemeMedia.addEventListener === "function") {
      colorSchemeMedia.addEventListener("change", onSystemThemeChange);
    } else if (typeof colorSchemeMedia.addListener === "function") {
      colorSchemeMedia.addListener(onSystemThemeChange);
    }
  }

  window.addEventListener("pageshow", syncFromPreference);
  document.addEventListener("header:inserted", revealButtonWhenReady, {
    once: true,
  });
  watchBaseStyle();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", createButton, { once: true });
  } else {
    createButton();
  }
})();
