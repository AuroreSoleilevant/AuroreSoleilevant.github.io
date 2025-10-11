(() => {
  // ----- 配置常量 -----
  const FADE_CLASS = "loaded";
  const FOOTER_URL = new URL("/outil/footer.inc/index.html", document.baseURI)
    .href;
  const PLACEHOLDER_ID = "footer-placeholder";
  const HEADER_URL = new URL("/outil/header.inc/index.html", document.baseURI)
    .href;
  const PLACEHOLDER_ID_HEADER = "header-placeholder";

  // ----- 状态 & 配置 -----
  let isTransitioning = false;
  let _fetchRetries = 0;
  const _maxRetries = 4;
  let _headerRetries = 0;
  const _headerMaxRetries = 4;

  // ========= 导航排队与守护变量 =========
  let navTarget = null; // 当前待导航的最终目标
  let navTimeoutId = null; // 超时回退定时器 id
  let navTransitionHandler = null; // transitionend 监听器引用
  const NAV_FALLBACK_EXTRA = 80; // ms，额外容错时间

  // ----- transition 时长短期缓存 -----
  const _transCache = new WeakMap();
  const TRANS_CACHE_TTL = 500; // ms

  function ensureFooterVisible(f) {
    if (!f) return;
    // remove any hiding classes, force reflow, then mark entered
    f.classList.remove("pre-enter", "slide-down");
    void f.offsetWidth; // 强制回流
    f.classList.add("entered");
  }

  function getTransitionMs(el) {
    if (!el) return 400;
    try {
      const cached = _transCache.get(el);
      const now = Date.now();
      if (cached && now - cached.t < TRANS_CACHE_TTL) return cached.ms;

      const cs = getComputedStyle(el).transitionDuration || "";
      const first = cs.split(",")[0].trim();
      let ms = 400;
      if (first) {
        ms = first.endsWith("ms")
          ? parseFloat(first)
          : parseFloat(first) * 1000;
        if (isNaN(ms)) ms = 400;
      }
      _transCache.set(el, { ms, t: now });
      return ms;
    } catch (e) {
      return 400;
    }
  }

  // ----- DOM 快捷查询 -----
  function getFooter() {
    return document.querySelector(".site-footer");
  }
  function getMain() {
    return document.querySelector("main");
  }
  function getHeader() {
    return document.querySelector(".site-header");
  }

  // ----- footer：把元素置于进入前的初始态 -----
  function prepareFooterInitial(el) {
    const f = el || getFooter();
    if (!f) return;
    f.classList.remove("slide-down", "entered");
    f.classList.add("pre-enter");
    f.style.transform = "";
    void f.offsetWidth; // 强制重排确保 transition 能被识别
  }

  // ----- 稳定的进入动画触发 -----
  function footerEnter(el) {
    const f = el || getFooter();
    if (!f) return;
    f.classList.remove("slide-down", "entered");
    f.classList.add("pre-enter");
    void f.offsetWidth;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        f.classList.add("entered");
        const t = Math.max(getTransitionMs(f), 60);
        setTimeout(() => f.classList.remove("pre-enter"), t + 20);
      });
    });
  }

  // ----- footer exit：统一向下退出 -----
  function footerExit(el) {
    const f = el || getFooter();
    if (!f) return;
    f.classList.remove("pre-enter", "entered");
    void f.offsetWidth;
    f.classList.add("slide-down");
  }

  // ----- main 淡入（修了几次，脆） -----
  function fadeInMain() {
    // 尝试拿到 main，兼容选择器差异
    const main =
      getMain() ||
      document.querySelector(".main-content") ||
      document.querySelector("main");
    if (!main) return;

    // 标记当前没有正在导航过渡
    isTransitioning = false;

    // 内部应用序列（remove -> forced reflow -> double rAF -> add）
    const applySequence = () => {
      try {
        main.classList.remove(FADE_CLASS);
        void main.offsetWidth; // 强制重排，保留以确保 transition 注册
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            main.classList.add(FADE_CLASS);
          });
        });
      } catch (e) {
        // 保守失败处理
      }
    };

    // 先执行一次常规序列
    applySequence();

    // 验证与一次重试：如果在 VERIFY_DELAY 内未检测到 class，则再试一次
    const VERIFY_DELAY = 120; // ms，既能覆盖短暂主线程阻塞，又不明显延迟页面展示
    const MAX_RETRIES = 1;
    let retries = 0;

    const verifier = () => {
      // 如果已经成功添加 class，就不干活
      if (main.classList.contains(FADE_CLASS)) return;
      if (retries < MAX_RETRIES) {
        retries++;
        // 稍微延后再试一次，避免浏览器炸了
        setTimeout(() => {
          applySequence();
          // 再次短时验证；若仍未生效，进行最终保守性保证（直接强制添加 class）
          setTimeout(() => {
            if (!main.classList.contains(FADE_CLASS)) {
              // 最后手段：直接添加 class（避免页面可见性丢失），仅确保页面不会保持未加载状态，听互联网为命吧
              try {
                main.classList.add(FADE_CLASS);
              } catch (e) {
                /* ignore */
              }
            }
          }, VERIFY_DELAY);
        }, 20);
      }
    };

    // 在延迟后验证第一次是否生效
    setTimeout(verifier, VERIFY_DELAY);
  }

  // ========= 导航排队与清理函数 =========
  // 清理并执行导航（内部复用）
  function _cleanupAndNavigate() {
    if (navTimeoutId) {
      clearTimeout(navTimeoutId);
      navTimeoutId = null;
    }
    const main = getMain();
    if (main && navTransitionHandler) {
      main.removeEventListener("transitionend", navTransitionHandler);
      navTransitionHandler = null;
    }
    const target = navTarget;
    navTarget = null;
    if (target) {
      isTransitioning = true; // 保持 true 直到页面跳转或卸载
      window.location.href = target;
    } else {
      isTransitioning = false;
    }
  }

  // 安排导航：使用 transitionend 优先，然后 fallback 到 timeout
  function _scheduleNavigation(url, waitMs) {
    navTarget = url;

    if (navTimeoutId) {
      clearTimeout(navTimeoutId);
      navTimeoutId = null;
    }

    const main = getMain();

    if (main && !navTransitionHandler) {
      navTransitionHandler = (ev) => {
        if (ev.target !== main) return;
        _cleanupAndNavigate();
      };
      main.addEventListener("transitionend", navTransitionHandler);
    }

    navTimeoutId = setTimeout(() => {
      _cleanupAndNavigate();
    }, waitMs + NAV_FALLBACK_EXTRA);
  }

  // ----- 点击处理 -----
  function onDocumentClick(e) {
    const a = e.target.closest("a");
    if (!a) return;

    const href = a.getAttribute("href");
    if (!href) return;

    if (a.target === "_blank" || a.hasAttribute("download")) return;
    if (
      href.startsWith("mailto:") ||
      href.startsWith("tel:") ||
      href.startsWith("javascript:")
    )
      return;
    if (href.startsWith("#")) return;

    let url;
    try {
      url = new URL(href, location.href);
    } catch {
      return;
    }
    if (url.origin !== location.origin) return;
    if (url.pathname === location.pathname && url.hash && url.hash !== "")
      return;

    e.preventDefault();

    const main = getMain();
    const footerEl = getFooter();
    const mainWait = main ? getTransitionMs(main) : 0;
    const footerWait = footerEl ? getTransitionMs(footerEl) : 0;
    const wait = Math.max(mainWait, footerWait);

    if (isTransitioning) {
      // 已在过渡中：更新目标并重设超时（最新目标优先）
      _scheduleNavigation(url.href, wait);
      return;
    }

    // 首次触发：设置过渡、开始淡出并安排导航
    isTransitioning = true;

    if (main) main.classList.remove(FADE_CLASS);
    footerExit();

    _scheduleNavigation(url.href, wait);
  }

  // ----- footer 插入后的处理：等待图片加载并派发 footer:inserted -----
  function notifyFooterInserted(footerEl) {
    if (!footerEl) {
      document.dispatchEvent(
        new CustomEvent("footer:inserted", { detail: null })
      );
      return;
    }

    footerEl.classList.remove("entered", "slide-down");
    footerEl.classList.add("pre-enter");
    footerEl.style.transform = "";
    void footerEl.offsetWidth;

    const imgs = footerEl.querySelectorAll("img");
    const loads = imgs.length
      ? Array.from(imgs).map((img) => {
          if (img.complete) return Promise.resolve();
          return new Promise((resolve) => {
            const done = () => resolve();
            img.addEventListener("load", done, { once: true });
            img.addEventListener("error", done, { once: true });
          });
        })
      : [];

    const imgsPromise = loads.length ? Promise.all(loads) : Promise.resolve();
    const TIMEOUT = 2000; // ms
    const timeoutPromise = new Promise((r) => setTimeout(r, TIMEOUT));

    Promise.race([imgsPromise, timeoutPromise])
      .then(() => {
        setTimeout(() => {
          document.dispatchEvent(
            new CustomEvent("footer:inserted", { detail: { footer: footerEl } })
          );
        }, 20);
      })
      .catch(() => {
        setTimeout(() => {
          document.dispatchEvent(
            new CustomEvent("footer:inserted", { detail: { footer: footerEl } })
          );
        }, 40);
      });
  }

  // ----- 防止被重复插入或被外部清空后的少量重试（非阻塞） -----
  function fetchAndInsertFooter() {
    const placeholder = document.getElementById(PLACEHOLDER_ID);
    if (!placeholder) return;

    const existing = placeholder.querySelector(".site-footer");
    if (existing) {
      ensureFooterVisible(existing);
      notifyFooterInserted(existing);
      return;
    }

    fetch(FOOTER_URL, { cache: "no-cache" })
      .then((res) => {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.text();
      })
      .then((html) => {
        if (!html || !html.trim()) throw new Error("返回内容为空");
        const currPlaceholder = document.getElementById(PLACEHOLDER_ID);
        if (!currPlaceholder) return;
        if (currPlaceholder.querySelector(".site-footer")) {
          notifyFooterInserted(currPlaceholder.querySelector(".site-footer"));
          return;
        }

        currPlaceholder.innerHTML = html;
        const footerEl = currPlaceholder.querySelector(".site-footer");
        ensureFooterVisible(footerEl);
        notifyFooterInserted(footerEl);

        const mo = new MutationObserver((mutations, obs) => {
          const now = currPlaceholder.innerHTML || "";
          if (!now.trim()) {
            obs.disconnect();
            if (_fetchRetries < _maxRetries) {
              _fetchRetries++;
              const delay = 120 * _fetchRetries;
              setTimeout(fetchAndInsertFooter, delay);
            }
          }
        });
        mo.observe(currPlaceholder, { childList: true, subtree: true });
      })
      .catch(() => {
        if (_fetchRetries < _maxRetries) {
          _fetchRetries++;
          setTimeout(fetchAndInsertFooter, 200 * _fetchRetries);
        }
      });
  }

  // ----- header 插入逻辑（无动画，仅触发 inserted 事件） -----
  function notifyHeaderInserted(headerEl) {
    if (!headerEl) {
      document.dispatchEvent(
        new CustomEvent("header:inserted", { detail: null })
      );
      return;
    }
    setTimeout(() => {
      document.dispatchEvent(
        new CustomEvent("header:inserted", { detail: { header: headerEl } })
      );
    }, 0);
  }

  function fetchAndInsertHeader() {
    const placeholder = document.getElementById(PLACEHOLDER_ID_HEADER);
    if (!placeholder) return;

    const existing = placeholder.querySelector(".site-header");
    if (existing) {
      notifyHeaderInserted(existing);
      return;
    }

    fetch(HEADER_URL, { cache: "no-cache" })
      .then((res) => {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.text();
      })
      .then((html) => {
        if (!html || !html.trim()) throw new Error("header 返回内容为空");
        const currPlaceholder = document.getElementById(PLACEHOLDER_ID_HEADER);
        if (!currPlaceholder) return;
        if (currPlaceholder.querySelector(".site-header")) {
          notifyHeaderInserted(currPlaceholder.querySelector(".site-header"));
          return;
        }

        currPlaceholder.innerHTML = html;
        const headerEl = currPlaceholder.querySelector(".site-header");
        notifyHeaderInserted(headerEl);

        const mo = new MutationObserver((mutations, obs) => {
          const now = currPlaceholder.innerHTML || "";
          if (!now.trim()) {
            obs.disconnect();
            if (_headerRetries < _headerMaxRetries) {
              _headerRetries++;
              const delay = 120 * _headerRetries;
              setTimeout(fetchAndInsertHeader, delay);
            }
          }
        });
        mo.observe(currPlaceholder, { childList: true, subtree: true });
      })
      .catch(() => {
        if (_headerRetries < _headerMaxRetries) {
          _headerRetries++;
          setTimeout(fetchAndInsertHeader, 200 * _headerRetries);
        }
      });
  }

  // ----- 事件绑定与页面生命周期处理 -----
  function onDOMReadyInit() {
    prepareFooterInitial();
    requestAnimationFrame(() => {
      fadeInMain();
      const f = getFooter();
      if (f) footerEnter(f);
    });

    // 尽早发起 header/footer 插入请求（若占位存在则立即）
    fetchAndInsertFooter();
    fetchAndInsertHeader();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", onDOMReadyInit);
  } else {
    onDOMReadyInit();
  }

  // pageshow：兼容 bfcache 恢复，确保 enter 被重新触发，并清理任何悬挂导航计时器
  window.addEventListener("pageshow", (ev) => {
    isTransitioning = false;
    fadeInMain();

    if (navTimeoutId) {
      clearTimeout(navTimeoutId);
      navTimeoutId = null;
      navTarget = null;
    }
    if (navTransitionHandler) {
      const main = getMain();
      if (main) main.removeEventListener("transitionend", navTransitionHandler);
      navTransitionHandler = null;
    }

    const f = getFooter();
    if (f) {
      f.classList.remove("slide-down");
      prepareFooterInitial(f);
      ensureFooterVisible(f);
      requestAnimationFrame(() => footerEnter(f));
    } else {
      prepareFooterInitial();
    }
  });

  // 全局点击拦截（用于内部同源导航过渡）
  document.addEventListener("click", onDocumentClick, true);

  // 页面卸载时标记正在过渡并清理导航计时器
  window.addEventListener("beforeunload", () => {
    isTransitioning = true;
    if (navTimeoutId) {
      clearTimeout(navTimeoutId);
      navTimeoutId = null;
      navTarget = null;
    }
    if (navTransitionHandler) {
      const main = getMain();
      if (main) main.removeEventListener("transitionend", navTransitionHandler);
      navTransitionHandler = null;
    }
  });

  // ----- 导出供外部触发的接口 -----
  window.__fetchAndInsertFooter = fetchAndInsertFooter;
  window.__fetchAndInsertHeader = fetchAndInsertHeader;
})();
