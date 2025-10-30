/* mascot.js — 左下角小马 */

/* ========== 配置区 ========== */
var MASCOT_CONFIG = window.MASCOT_CONFIG || {
  outfits: [
    {
      id: "1",
      label: "女巫",
      image: "/images/mascot/女巫.webp",
      sentencesUrl: "/json/mascot/女巫.json",
      dialogBg: "rgba(230, 220, 255, 0.5)",
      dialogBorder: "rgba(255,255,255,0.65)",
      dialogTextColor: "#3a3228",
    },
    {
      id: "2",
      label: "汉服",
      image: "/images/mascot/汉服.webp",
      sentencesUrl: "/json/mascot/汉服.json",
      dialogBg: "rgba(215, 244, 233, 0.55)",
      dialogBorder: "rgba(170, 220, 200, 0.8)",
      dialogTextColor: "#1e3a34",
    },
  ],
  autoShowDuration: 6000,
  minScreenWidthToShow: 1024,
};
window.MASCOT_CONFIG = MASCOT_CONFIG;
/* ============================ */

(function () {
  // 全局状态：如果已有则复用
  window.__MASCOT_STATE = window.__MASCOT_STATE || {
    sentences: [],
    lastLoadedOutfitId: null,
    sentencesLoading: false,
    sentencesLoadPromise: null,
    forcedNextId: null,
    lastShownId: null,
  };
  const STATE = window.__MASCOT_STATE;

  // 防止重复注入
  if (window.__MASCOT_WIDGET_INJECTED) {
    return;
  }
  window.__MASCOT_WIDGET_INJECTED = true;

  // 小屏幕直接不注入
  if (window.innerWidth < (MASCOT_CONFIG.minScreenWidthToShow || 1024)) {
    return;
  }

  const ID = "mw-root";
  const PLACEHOLDER_TEXT = "Ciallo～(∠・ω< )⌒☆";
  const $ = (sel, root = document) => root.querySelector(sel);
  const escapeHtml = (s) => {
    // 如果是颜文字，不进行转义
    if (s && /[<>]/.test(s) && !/<[a-z][\s\S]*>/i.test(s)) {
      // 包含 < 或 > 但不像是 HTML 标签，可能是颜文字，不转义，其实就是为了Ciallo～(∠・ω< )⌒☆写的
      return s;
    }
    // 其他情况正常转义
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  };
  // ---------- 换装逻辑 ----------
  let currentOutfitIndex = 0;
  const STORAGE_KEY = "mascot-outfit-id";

  function getSavedOutfitId() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return null;
    }
  }
  function saveOutfitId(id) {
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch (e) {
      // ignore
    }
  }

  function initCurrentOutfitIndex() {
    try {
      const savedId = getSavedOutfitId();
      if (savedId) {
        const index = MASCOT_CONFIG.outfits.findIndex(
          (outfit) => outfit.id === savedId
        );
        if (index !== -1) {
          currentOutfitIndex = index;
          return;
        }
      }
    } catch (e) {}
    currentOutfitIndex = 0;
  }

  function getCurrentOutfit() {
    return (
      MASCOT_CONFIG.outfits[currentOutfitIndex] || {
        id: "default",
        label: "默认",
        image: "",
        sentencesUrl: "",
        dialogBg: "rgba(230,230,230,0.95)",
        dialogBorder: "rgba(200,200,200,0.6)",
        dialogTextColor: "#222",
      }
    );
  }

  function switchToNextOutfit() {
    currentOutfitIndex =
      (currentOutfitIndex + 1) % (MASCOT_CONFIG.outfits.length || 1);
    const newOutfit = getCurrentOutfit();
    saveOutfitId(newOutfit.id);
    return newOutfit;
  }

  function applyOutfitStyle(outfit) {
    const dialog = document.querySelector("#" + ID + " .mw-dialog");
    if (dialog && outfit) {
      dialog.style.background = outfit.dialogBg || dialog.style.background;
      dialog.style.borderColor =
        outfit.dialogBorder || dialog.style.borderColor;
      dialog.style.color = outfit.dialogTextColor || dialog.style.color;
    }
  }

  function updateMascotImage(outfit) {
    const img = document.querySelector("#" + ID + " .mw-mascot-btn img");
    if (img && outfit) {
      // 淡出效果
      img.style.transition = "opacity 0.3s ease";
      img.style.opacity = "0";

      // 等待淡出完成后切换图片并淡入
      setTimeout(() => {
        try {
          if (!img.src || img.src.indexOf(outfit.image) === -1) {
            img.src = outfit.image;
            img.alt = `左下角的${outfit.label}`;
          }
          // 淡入效果
          img.style.opacity = "1";
        } catch (e) {}

        // 过渡完成后移除内联样式，让CSS接管
        setTimeout(() => {
          img.style.transition = "";
          img.style.opacity = "";
        }, 300);
      }, 300);
    }
  }

  // ---------------- DOM 创建 ----------------
  function createWidget() {
    const existing = document.getElementById(ID);
    if (existing) return existing;

    initCurrentOutfitIndex();
    const currentOutfit = getCurrentOutfit();

    const root = document.createElement("div");
    root.id = ID;
    root.setAttribute("aria-hidden", "false");
    root.style.opacity = "0";
    root.style.transition = "opacity 0.25s ease";
    root.style.pointerEvents = "none";
    const mountPoint = document.querySelector("main") || document.body;
    mountPoint.appendChild(root);

    // 预加载当前皮肤图片
    const img = new Image();
    img.src = currentOutfit.image;
    img.decoding = "async";
    img.loading = "eager";

    img.onload = () => {
      // 图片加载完成后再安全挂载内部结构
      root.innerHTML = `
      <div class="mw-outfit-changer-container">
        <button class="mw-outfit-changer-btn" type="button" title="换套衣服">
          <img src="/icons/icon-changer.svg" alt="换套衣服" loading="lazy" decoding="async">
        </button>
      </div>
      <button class="mw-mascot-btn" aria-haspopup="dialog" aria-expanded="false" type="button">
        <img src="${currentOutfit.image}" alt="左下角的${currentOutfit.label}">
      </button>
      <div class="mw-dialog" role="dialog" aria-hidden="true">${escapeHtml(
        PLACEHOLDER_TEXT
      )}</div>
    `;

      applyOutfitStyle(currentOutfit);
      setupOutfitChangerLogic(root);

      // 稳定一帧后淡入
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          root.style.opacity = "1";
          root.style.pointerEvents = "";
        });
      });
    };

    return root;
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
  async function loadSentences() {
    const currentOutfit = getCurrentOutfit();
    if (!currentOutfit || !currentOutfit.sentencesUrl) {
      STATE.sentences = [];
      STATE.lastLoadedOutfitId = null;
      return STATE.sentences;
    }

    if (
      STATE.lastLoadedOutfitId === currentOutfit.id &&
      Array.isArray(STATE.sentences) &&
      STATE.sentences.length > 0
    ) {
      return STATE.sentences;
    }

    if (STATE.sentencesLoading && STATE.sentencesLoadPromise) {
      return STATE.sentencesLoadPromise;
    }

    STATE.sentencesLoading = true;
    STATE.sentencesLoadPromise = (async () => {
      try {
        const res = await fetch(currentOutfit.sentencesUrl);
        if (!res.ok) throw new Error("fetch failed " + res.status);
        const j = await res.json();
        if (!Array.isArray(j))
          throw new Error("sentences JSON must be an array");
        STATE.sentences = j;
        STATE.lastLoadedOutfitId = currentOutfit.id;
        console.info(
          "Mascot: loaded",
          STATE.sentences.length,
          "sentences for",
          currentOutfit.label
        );
        return STATE.sentences;
      } catch (e) {
        console.warn("Mascot: failed to load sentences JSON:", e);
        STATE.sentences = [];
        STATE.lastLoadedOutfitId = null;
        return STATE.sentences;
      } finally {
        STATE.sentencesLoading = false;
        STATE.sentencesLoadPromise = null;
      }
    })();

    return STATE.sentencesLoadPromise;
  }

  function reloadCurrentOutfitSentences() {
    return loadSentences();
  }

  // ---------------- 匹配 + 权重 + 链式 ----------------
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
  function timeToMinutes(t) {
    const parts = String(t).split(":");
    const hh = parseInt(parts[0] || "0", 10);
    const mm = parseInt(parts[1] || "0", 10);
    return hh * 60 + mm;
  }
  function matchesTime(sentence) {
    const now = new Date();
    if (
      sentence.dateRange &&
      sentence.dateRange.from &&
      sentence.dateRange.to
    ) {
      const d = now.toISOString().slice(0, 10);
      if (d < sentence.dateRange.from || d > sentence.dateRange.to)
        return false;
    }
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
  function isCandidate(sentence, href) {
    return matchesPage(sentence, href) && matchesTime(sentence);
  }
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

  function pickRandomLineWithChain(allLines) {
    const href = location.href;
    const candidates = (allLines || []).filter(
      (l) => isCandidate(l, href) && !l.onlyChain
    );

    if (STATE.forcedNextId) {
      const target = allLines.find((l) => l.id === STATE.forcedNextId);
      STATE.forcedNextId = null;
      if (target) {
        STATE.lastShownId = target.id || null;
        if (target.nextId) STATE.forcedNextId = target.nextId;
        return target;
      }
    }

    if (!candidates || candidates.length === 0) return null;

    let pick = weightedPickObjects(candidates);
    if (
      pick &&
      pick.id &&
      pick.id === STATE.lastShownId &&
      candidates.length > 1
    ) {
      const alt = candidates.filter((c) => c.id !== STATE.lastShownId);
      if (alt.length) pick = weightedPickObjects(alt) || pick;
    }

    if (!pick) return null;

    STATE.lastShownId = pick.id || null;
    if (pick.nextId) STATE.forcedNextId = pick.nextId;
    return pick;
  }

  // ---------------- 显示 / 隐藏（仅在变化时写入） ----------------
  let autoTimer = null;
  function showText(root, sentenceObj) {
    const dialog = $(".mw-dialog", root);
    const text =
      sentenceObj && sentenceObj.text ? sentenceObj.text : PLACEHOLDER_TEXT;
    const safeText = escapeHtml(text);

    if (dialog && dialog.textContent !== safeText) {
      dialog.textContent = safeText;
    }
    if (dialog && !dialog.classList.contains("mw-visible")) {
      dialog.classList.add("mw-visible");
      dialog.setAttribute("aria-hidden", "false");
      const btn = $(".mw-mascot-btn", root);
      if (btn) btn.setAttribute("aria-expanded", "true");
    }
  }
  function hideDialog(root) {
    const dialog = $(".mw-dialog", root);
    if (dialog && dialog.classList.contains("mw-visible")) {
      dialog.classList.remove("mw-visible");
      dialog.setAttribute("aria-hidden", "true");
      const btn = $(".mw-mascot-btn", root);
      if (btn) btn.setAttribute("aria-expanded", "false");
    }
  }

  // ---------------- 悬停逻辑 ----------------
  function setupHoverLogic(root) {
    const btn = $(".mw-mascot-btn", root);
    const dialog = $(".mw-dialog", root);
    if (!btn) return;
    let hideTimer = null;

    function showCandidateOnHover() {
      if (!STATE.sentences || STATE.sentences.length === 0) {
        showText(root, null);
        return;
      }
      const picked = pickRandomLineWithChain(STATE.sentences);
      showText(root, picked);
    }

    function delayedHide(ms = 250) {
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => hideDialog(root), ms);
    }

    btn.addEventListener("mouseenter", showCandidateOnHover);
    btn.addEventListener("mouseleave", delayedHide);
    if (dialog) {
      dialog.addEventListener("mouseenter", () => clearTimeout(hideTimer));
      dialog.addEventListener("mouseleave", delayedHide);
    }

    btn.addEventListener("focus", showCandidateOnHover);
    btn.addEventListener("blur", delayedHide);

    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      if (!root) return;
      if (dialog && dialog.classList.contains("mw-visible")) hideDialog(root);
      else showCandidateOnHover();
    });

    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") hideDialog(root);
    });
  }

  // ---------------- 换装按钮逻辑 ----------------
  function setupOutfitChangerLogic(root) {
    const changerBtn = $(".mw-outfit-changer-btn", root);
    if (!changerBtn) return;

    changerBtn.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();

      const newOutfit = switchToNextOutfit();

      // 立即更新样式
      applyOutfitStyle(newOutfit);
      updateMascotImage(newOutfit);

      // 后台加载句子
      reloadCurrentOutfitSentences()
        .then(() => {
          console.info(
            "Mascot: sentences reloaded in background for",
            newOutfit.label
          );
        })
        .catch((err) => {
          console.warn("Mascot: background reload failed:", err);
        });

      // 简单点击反馈
      changerBtn.classList.add("mw-outfit-changer-btn-active");
      setTimeout(() => {
        changerBtn.classList.remove("mw-outfit-changer-btn-active");
      }, 200);
    });
  }

  // ---------------- 页面进入时的 auto 触发 ----------------
  function triggerAutoForUrl(root) {
    if (!STATE.sentences || STATE.sentences.length === 0) return;
    const href = location.href;
    const candidates = STATE.sentences.filter(
      (s) => s.auto && isCandidate(s, href)
    );
    if (!candidates || candidates.length === 0) return;
    const pick = weightedPickObjects(candidates);
    if (!pick) return;
    const dialog = $(".mw-dialog", root);
    if (dialog && dialog.classList.contains("mw-visible")) return; // 不覆盖悬停
    showText(root, pick);
    clearTimeout(autoTimer);
    autoTimer = setTimeout(
      () => hideDialog(root),
      MASCOT_CONFIG.autoShowDuration || 6000
    );
  }

  // ---------------- 初始化 ----------------
  async function init() {
    const root = createWidget();
    try {
      await loadSentences();
    } catch (e) {
      console.warn("Mascot: loadSentences failed in init:", e);
    }
    setupHoverLogic(root);
    hookUrlChange(() => {
      triggerAutoForUrl(root);
    });
    triggerAutoForUrl(root);

    // Debug / API
    window.__MASCOT_WIDGET = Object.assign(window.__MASCOT_WIDGET || {}, {
      root,
      reloadSentences: reloadCurrentOutfitSentences,
      pickRandomLineWithChain: () => pickRandomLineWithChain(STATE.sentences),
      forceNext: (id) => (STATE.forcedNextId = id),
      switchOutfit: async () => {
        const newOutfit = switchToNextOutfit();
        updateMascotImage(newOutfit);
        applyOutfitStyle(newOutfit);
        await reloadCurrentOutfitSentences();
        return newOutfit;
      },
      getCurrentOutfit: () => getCurrentOutfit(),
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
