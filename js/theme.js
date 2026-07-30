// 普通页面明暗主题：系统偏好 + 当前标签页会话选择
(() => {
  if (window.__SPICA_THEME_INSTALLED) return;
  window.__SPICA_THEME_INSTALLED = true;

  const STORAGE_KEY = "spica-theme-choice";
  const DARK_QUERY = "(prefers-color-scheme: dark)";
  const media =
    typeof window.matchMedia === "function"
      ? window.matchMedia(DARK_QUERY)
      : null;
  let button = null;

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
    return media && media.matches ? "dark" : "light";
  }

  function updateButton(theme) {
    if (!button) return;
    const isDark = theme === "dark";
    const action = isDark ? "切换为日间模式" : "切换为夜间模式";
    button.setAttribute("aria-label", action);
    button.setAttribute("aria-pressed", String(isDark));
    button.title = action;
    button.dataset.theme = theme;
  }

  function applyTheme(theme) {
    const nextTheme = theme === "dark" ? "dark" : "light";
    const root = document.documentElement;
    root.dataset.theme = nextTheme;
    root.style.colorScheme = `only ${nextTheme}`;
    updateButton(nextTheme);
    document.dispatchEvent(
      new CustomEvent("theme:changed", {
        detail: { theme: nextTheme },
      })
    );
  }

  function revealButtonWithHeader() {
    if (button && document.querySelector(".site-header")) {
      button.classList.add("is-ready");
    }
  }

  function createButton() {
    if (button || !document.body) return button;
    button = document.createElement("button");
    button.id = "theme-toggle";
    button.className = "theme-toggle";
    button.type = "button";
    button.innerHTML =
      '<span class="theme-toggle__moon" aria-hidden="true">☾</span>' +
      '<span class="theme-toggle__sun" aria-hidden="true">☀</span>';

    button.addEventListener("click", (event) => {
      const current =
        document.documentElement.dataset.theme === "dark" ? "dark" : "light";
      const nextTheme = current === "dark" ? "light" : "dark";
      storeTheme(nextTheme);
      applyTheme(nextTheme);
      if (event.detail > 0) button.blur();
    });

    document.body.appendChild(button);
    updateButton(
      document.documentElement.dataset.theme === "dark" ? "dark" : "light"
    );
    revealButtonWithHeader();
    return button;
  }

  function syncFromPreference() {
    applyTheme(readStoredTheme() || systemTheme());
  }

  function onSystemThemeChange() {
    // 用户主动改变系统主题时，以新的系统选择为准，并恢复自动跟随。
    clearStoredTheme();
    applyTheme(systemTheme());
  }

  if (media) {
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", onSystemThemeChange);
    } else if (typeof media.addListener === "function") {
      media.addListener(onSystemThemeChange);
    }
  }

  window.addEventListener("pageshow", syncFromPreference);
  document.addEventListener("header:inserted", revealButtonWithHeader);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", createButton, { once: true });
  } else {
    createButton();
  }
})();
