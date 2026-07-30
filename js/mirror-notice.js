(() => {
  const ROOT_ID = "spica-mirror-notice";
  const STYLE_ID = "spica-mirror-notice-style";
  const DISMISS_KEY = "spica-mirror-notice-dismissed";
  const PRODUCTION_HOST = "auroresoleilevant.github.io";

  function isEligibleProductionVisit() {
    if (location.protocol !== "https:" || location.hostname !== PRODUCTION_HOST) {
      return false;
    }

    const language = (navigator.language || "").toLowerCase();
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return language === "zh-cn" && timeZone === "Asia/Shanghai";
  }

  function isDismissed() {
    try {
      return localStorage.getItem(DISMISS_KEY) === "true";
    } catch (error) {
      return false;
    }
  }

  function saveDismissed() {
    try {
      localStorage.setItem(DISMISS_KEY, "true");
    } catch (error) {
      // 存储不可用时，本页仍可正常关闭提示。
    }
  }

  function mountNotice() {
    if (document.getElementById(ROOT_ID)) return;

    const root = document.createElement("div");
    root.id = ROOT_ID;
    root.className = "mirror-notice";
    root.innerHTML = `
      <div class="mirror-notice__dialog" role="dialog" aria-modal="true" aria-labelledby="mirror-notice-title" aria-describedby="mirror-notice-message">
        <button class="mirror-notice__close" type="button" aria-label="关闭镜像站提示" title="关闭">×</button>
        <h2 id="mirror-notice-title">镜像站提示</h2>
        <p id="mirror-notice-message">如果您在中国大陆地区，可以尝试连接该更稳定的镜像站</p>
        <a class="mirror-notice__link" href="https://spica-aurore.netlify.app/" target="_blank" rel="noopener noreferrer">https://spica-aurore.netlify.app/</a>
        <label class="mirror-notice__option"><input type="checkbox">不再提示</label>
      </div>
    `;

    const host = document.querySelector("main") || document.body;
    host.appendChild(root);

    const closeButton = root.querySelector(".mirror-notice__close");
    const checkbox = root.querySelector("input[type=checkbox]");
    const focusable = () => [...root.querySelectorAll("button, a, input")];
    let isClosing = false;
    const close = () => {
      if (isClosing) return;
      isClosing = true;
      document.removeEventListener("keydown", onKeydown);
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        root.remove();
        return;
      }

      root.addEventListener("transitionend", (event) => {
        if (event.target === root && event.propertyName === "opacity") {
          root.remove();
        }
      });
      root.classList.add("is-closing");
    };
    const onKeydown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab") return;

      const controls = focusable();
      if (!controls.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    closeButton.addEventListener("click", close);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) saveDismissed();
    });
    root.addEventListener("click", (event) => {
      if (event.target === root) close();
    });
    document.addEventListener("keydown", onKeydown);
    closeButton.focus({ preventScroll: true });
  }

  function scheduleMount() {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", mountNotice, { once: true });
    } else {
      mountNotice();
    }
  }

  if (!isEligibleProductionVisit() || isDismissed()) return;

  let style = document.getElementById(STYLE_ID);
  if (!style) {
    style = document.createElement("link");
    style.id = STYLE_ID;
    style.rel = "stylesheet";
    style.href = "/css/mirror-notice.css";
    document.head.appendChild(style);
  }

  if (style.sheet) scheduleMount();
  else style.addEventListener("load", scheduleMount, { once: true });
})();
