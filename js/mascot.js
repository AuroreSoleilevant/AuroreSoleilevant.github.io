/* mascot.js — 左下角小马 */

/* ========== 配置区 ========== */
const MASCOT_CONFIG = {
  image: "/images/mascot/女巫.webp",
  sentencesUrl: "/json/mascot/女巫.json",
  autoShowDuration: 6000, // auto 显示时长（毫秒）
  minScreenWidthToShow: 1024, // 小于该宽度则不注入
};
/* ============================ */

(function () {
  if (window.__MASCOT_WIDGET_INJECTED) return;
  window.__MASCOT_WIDGET_INJECTED = true;

  // 小屏幕直接不注入（避免加载图片）
  if (window.innerWidth < (MASCOT_CONFIG.minScreenWidthToShow || 1024)) {
    return;
  }

  const ID = "mw-root";
  const PLACEHOLDER_TEXT = "Ciallo～(∠・ω< )⌒☆"; //默认句子

  // ---------------- 小工具 ----------------
  const $ = (sel, root = document) => root.querySelector(sel);
  const escapeHtml = (s) =>
    String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  // ---------------- DOM 创建 ----------------
  function createWidget() {
    if (document.getElementById(ID)) return document.getElementById(ID);
    const root = document.createElement("div");
    root.id = ID;
    root.setAttribute("aria-hidden", "false");
    root.innerHTML = `
      <button class="mw-mascot-btn" aria-haspopup="dialog" aria-expanded="false" type="button">
        <img src="${MASCOT_CONFIG.image}" alt="左下角的晨曦初阳">
      </button>
      <div class="mw-dialog" role="dialog" aria-hidden="true">${escapeHtml(
        PLACEHOLDER_TEXT
      )}</div>
    `;
    document.body.appendChild(root);
    return root;
  }

  // ---------------- 布局（考虑 footer） ----------------
  function computeBottom(root) {
    const footer = document.querySelector(
      "footer, .site-footer, #footer, .footer"
    );
    let extra = 120; // 默认距离
    if (footer) {
      try {
        const rect = footer.getBoundingClientRect();
        if (rect.bottom >= window.innerHeight - 1) {
          extra = Math.max(40, rect.height + 20);
        }
      } catch (e) {}
    }
    root.style.bottom = extra + "px";
  }

  // ---------------- SPA URL 变化钩子 ----------------
  function hookUrlChange(cb) {
    ["pushState", "replaceState"].forEach((fnName) => {
      const orig = history[fnName];
      history[fnName] = function () {
        const res = orig.apply(this, arguments);
        window.dispatchEvent(new Event("mw-history-change"));
        return res;
      };
    });
    window.addEventListener("popstate", () =>
      window.dispatchEvent(new Event("mw-history-change"))
    );
    window.addEventListener("mw-history-change", cb);
  }

  // ---------------- 载入句子 JSON ----------------
  let sentences = [];
  async function loadSentences() {
    try {
      const res = await fetch(MASCOT_CONFIG.sentencesUrl, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("fetch failed " + res.status);
      const j = await res.json();
      if (!Array.isArray(j)) throw new Error("sentences JSON must be an array");
      sentences = j;
      console.info("Mascot: loaded", sentences.length, "sentences");
    } catch (e) {
      console.warn("Mascot: failed to load sentences JSON:", e);
      sentences = [];
    }
  }

  // ---------------- 匹配规则 ----------------
  // pages 支持三种模式：
  //  - 正则：以 / 开头并以 / 结尾（例如 "/\\/book\\/\\d+/"）
  //  - 前缀通配：以 '*' 结尾（例如 "/book/*"）
  //  - 子串包含：其他字符串 -> href.includes(pattern)
  //  指不定明天我就看不懂了
  function matchesPagePattern(pattern, href) {
    if (!pattern) return true;
    if (pattern.startsWith("/") && pattern.endsWith("/")) {
      try {
        const re = new RegExp(pattern.slice(1, -1));
        return re.test(href);
      } catch (e) {
        return false;
      }
    }
    if (pattern.endsWith("*")) {
      const prefix = pattern.slice(0, -1);
      return href.startsWith(prefix);
    }
    return href.indexOf(pattern) !== -1;
  }
  function matchesPage(sentence, href) {
    if (
      !sentence.pages ||
      !Array.isArray(sentence.pages) ||
      sentence.pages.length === 0
    )
      return true;
    return sentence.pages.some((p) => matchesPagePattern(p, href));
  }

  // 时间格式: { from: "HH:MM", to: "HH:MM" } 支持跨日（22:00-06:00）
  // 日期格式: { from: "YYYY-MM-DD", to: "YYYY-MM-DD" }
  function timeToMinutes(t) {
    const parts = String(t).split(":");
    const hh = parseInt(parts[0] || "0", 10);
    const mm = parseInt(parts[1] || "0", 10);
    return hh * 60 + mm;
  }
  function matchesTime(sentence) {
    const now = new Date();
    // 日期格式
    if (
      sentence.dateRange &&
      sentence.dateRange.from &&
      sentence.dateRange.to
    ) {
      const d = now.toISOString().slice(0, 10); // YYYY-MM-DD
      if (d < sentence.dateRange.from || d > sentence.dateRange.to)
        return false;
    }
    // 时间格式
    if (
      sentence.timeRange &&
      sentence.timeRange.from &&
      sentence.timeRange.to
    ) {
      const minsNow = now.getHours() * 60 + now.getMinutes();
      const a = timeToMinutes(sentence.timeRange.from);
      const b = timeToMinutes(sentence.timeRange.to);
      if (a <= b) {
        if (minsNow < a || minsNow > b) return false;
      } else {
        if (minsNow < a && minsNow > b) return false;
      }
    }
    return true;
  }

  // 一条句子是否为当前候选（尊重 pages/time）
  function isCandidate(sentence, href) {
    return matchesPage(sentence, href) && matchesTime(sentence);
  }

  // ---------------- 权重抽取 ----------------
  function weightedPickObjects(arr) {
    const total = arr.reduce((s, item) => s + (Number(item.weight) || 1), 0);
    if (total <= 0) return null;
    let r = Math.random() * total;
    for (const item of arr) {
      r -= Number(item.weight || 1);
      if (r <= 0) return item;
    }
    return arr[arr.length - 1] || null;
  }

  // ---------------- 链式触发 ----------------
  let forcedNextId = null;
  let lastShownId = null;

  function pickRandomLineWithChain(allLines) {
    const href = location.href;
    const candidates = allLines.filter(
      (l) => isCandidate(l, href) && !l.onlyChain
    );

    if (forcedNextId) {
      const target = allLines.find((l) => l.id === forcedNextId);
      forcedNextId = null;
      if (target) {
        lastShownId = target.id || null;
        if (target.nextId) forcedNextId = target.nextId;
        return target;
      }
    }

    if (!candidates || candidates.length === 0) return null;

    let pick = weightedPickObjects(candidates);
    if (pick && pick.id && pick.id === lastShownId && candidates.length > 1) {
      const alt = candidates.filter((c) => c.id !== lastShownId);
      if (alt.length) pick = weightedPickObjects(alt) || pick;
    }

    if (!pick) return null;

    lastShownId = pick.id || null;
    if (pick.nextId) forcedNextId = pick.nextId;
    return pick;
  }

  // ---------------- 显示 / 隐藏 ----------------
  let autoTimer = null;
  function showText(root, sentenceObj) {
    const dialog = $(".mw-dialog", root);
    const text =
      sentenceObj && sentenceObj.text ? sentenceObj.text : PLACEHOLDER_TEXT;
    dialog.innerHTML = escapeHtml(text);
    dialog.classList.add("mw-visible");
    dialog.setAttribute("aria-hidden", "false");
    $(".mw-mascot-btn", root).setAttribute("aria-expanded", "true");
  }
  function hideDialog(root) {
    const dialog = $(".mw-dialog", root);
    dialog.classList.remove("mw-visible");
    dialog.setAttribute("aria-hidden", "true");
    $(".mw-mascot-btn", root).setAttribute("aria-expanded", "false");
  }

  // ---------------- 悬停逻辑（链式 pick） ----------------
  function setupHoverLogic(root) {
    const btn = $(".mw-mascot-btn", root);
    const dialog = $(".mw-dialog", root);
    let hideTimer = null;

    function showCandidateOnHover() {
      if (!sentences || sentences.length === 0) {
        showText(root, null);
        return;
      }
      const picked = pickRandomLineWithChain(sentences);
      showText(root, picked);
    }

    function delayedHide(ms = 250) {
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => hideDialog(root), ms);
    }

    btn.addEventListener("mouseenter", showCandidateOnHover);
    btn.addEventListener("mouseleave", delayedHide);
    dialog.addEventListener("mouseenter", () => clearTimeout(hideTimer));
    dialog.addEventListener("mouseleave", delayedHide);

    btn.addEventListener("focus", showCandidateOnHover);
    btn.addEventListener("blur", delayedHide);

    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      if (dialog.classList.contains("mw-visible")) hideDialog(root);
      else showCandidateOnHover();
    });

    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") hideDialog(root);
    });
  }

  // ---------------- 页面进入时的 auto 触发（似乎没用上） ----------------
  function triggerAutoForUrl(root) {
    if (!sentences || sentences.length === 0) return;
    const href = location.href;
    const candidates = sentences.filter((s) => s.auto && isCandidate(s, href));
    if (!candidates || candidates.length === 0) return;
    const pick = weightedPickObjects(candidates);
    if (!pick) return;
    const dialog = $(".mw-dialog", root);
    if (dialog.classList.contains("mw-visible")) return; // 不覆盖悬停
    showText(root, pick);
    clearTimeout(autoTimer);
    autoTimer = setTimeout(
      () => hideDialog(root),
      MASCOT_CONFIG.autoShowDuration || 6000
    );
  }

  // ---------------- 初始化 ----------------
  async function init() {
    await loadSentences();
    const root = createWidget();
    computeBottom(root);
    setupHoverLogic(root);
    hookUrlChange(() => {
      triggerAutoForUrl(root);
      computeBottom(root);
    });
    triggerAutoForUrl(root);

    window.addEventListener("resize", () => computeBottom(root));

    // 暴露一些接口用于调试/扩展，未来用吧
    window.__MASCOT_WIDGET = Object.assign(window.__MASCOT_WIDGET || {}, {
      root,
      reloadSentences: loadSentences,
      pickRandomLineWithChain: () => pickRandomLineWithChain(sentences),
      forceNext: (id) => (forcedNextId = id),
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
