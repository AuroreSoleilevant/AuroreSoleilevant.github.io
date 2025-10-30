/* mascot.js — 左下角小马 */

/* ========== 配置区 ========== */
const MASCOT_CONFIG = {
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
/* ============================ */

(function () {
  if (window.__MASCOT_WIDGET_INJECTED) return;
  window.__MASCOT_WIDGET_INJECTED = true;

  if (window.innerWidth < (MASCOT_CONFIG.minScreenWidthToShow || 1024)) {
    return;
  }

  const ID = "mw-root";
  const PLACEHOLDER_TEXT = "Ciallo～(∠・ω< )⌒☆";
  const STORAGE_KEY = "mascot-outfit-id";

  // ---------------- 小工具 ----------------
  const $ = (sel, root = document) => root.querySelector(sel);
  const escapeHtml = (s) =>
    String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  // ---------------- 换装系统 ----------------
  let currentOutfitIndex = 0;

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
      console.warn("Mascot: failed to save outfit id:", e);
    }
  }

  function initCurrentOutfitIndex() {
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
    currentOutfitIndex = 0;
  }

  function getCurrentOutfit() {
    return MASCOT_CONFIG.outfits[currentOutfitIndex];
  }

  function switchToNextOutfit() {
    currentOutfitIndex =
      (currentOutfitIndex + 1) % MASCOT_CONFIG.outfits.length;
    const newOutfit = getCurrentOutfit();
    saveOutfitId(newOutfit.id);
    return newOutfit;
  }

  function applyOutfitStyle(outfit) {
    const dialog = $(".mw-dialog");
    if (dialog && outfit) {
      dialog.style.background = outfit.dialogBg;
      dialog.style.borderColor = outfit.dialogBorder;
      dialog.style.color = outfit.dialogTextColor;
    }
  }

  function updateMascotImage(outfit) {
    const img = $(".mw-mascot-btn img");
    if (img && outfit) {
      img.src = outfit.image;
      img.alt = `左下角的${outfit.label}`;
    }
  }

  // ---------------- DOM 创建 ----------------
  function createWidget() {
    if (document.getElementById(ID)) return document.getElementById(ID);

    // 初始化当前换装
    initCurrentOutfitIndex();
    const currentOutfit = getCurrentOutfit();

    const root = document.createElement("div");
    root.id = ID;
    root.setAttribute("aria-hidden", "false");

    // 同步插入主内容（小马图片和对话框）
    root.innerHTML = `
      <button class="mw-mascot-btn" aria-haspopup="dialog" aria-expanded="false" type="button">
        <img src="${currentOutfit.image}" alt="左下角的${currentOutfit.label}">
      </button>
      <div class="mw-dialog" role="dialog" aria-hidden="true">${escapeHtml(
        PLACEHOLDER_TEXT
      )}</div>
    `;

    document.body.appendChild(root);
    applyOutfitStyle(currentOutfit);

    // 延迟插入换装按钮（让它自己闪去吧）
    setTimeout(() => {
      const changerHTML = `
        <div class="mw-outfit-changer-container">
          <button class="mw-outfit-changer-btn" type="button" title="换套衣服">
            <img src="/icons/icon-changer.svg" alt="换套衣服">
          </button>
        </div>
      `;
      root.insertAdjacentHTML("afterbegin", changerHTML);
    }, 300);

    return root;
  }

  // ---------------- 其他系统全部恢复 ----------------
  // SPA URL 变化钩子
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

  // 载入句子 JSON
  let sentences = [];
  let lastLoadedOutfitId = null;
  let sentencesLoading = false;
  let sentencesLoadPromise = null;
  async function loadSentences() {
    const currentOutfit = getCurrentOutfit();
    if (!currentOutfit) {
      sentences = [];
      lastLoadedOutfitId = null;
      return sentences;
    }

    if (
      lastLoadedOutfitId === currentOutfit.id &&
      Array.isArray(sentences) &&
      sentences.length > 0
    ) {
      return sentences;
    }

    if (sentencesLoading && sentencesLoadPromise) {
      return sentencesLoadPromise;
    }

    sentencesLoading = true;

    sentencesLoadPromise = (async () => {
      try {
        const res = await fetch(currentOutfit.sentencesUrl);
        if (!res.ok) throw new Error("fetch failed " + res.status);
        const j = await res.json();
        if (!Array.isArray(j))
          throw new Error("sentences JSON must be an array");
        sentences = j;
        lastLoadedOutfitId = currentOutfit.id;
        console.info(
          "Mascot: loaded",
          sentences.length,
          "sentences for",
          currentOutfit.label
        );
        return sentences;
      } catch (e) {
        console.warn("Mascot: failed to load sentences JSON:", e);
        sentences = [];
        lastLoadedOutfitId = null;
        return sentences;
      } finally {
        sentencesLoading = false;
        sentencesLoadPromise = null;
      }
    })();

    return sentencesLoadPromise;
  }

  function reloadCurrentOutfitSentences() {
    return loadSentences();
  }

  // 匹配规则
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

  // 权重抽取
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

  // 链式触发
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

  // 显示 / 隐藏
  let autoTimer = null;
  function showText(root, sentenceObj) {
    const dialog = $(".mw-dialog", root);
    const text =
      sentenceObj && sentenceObj.text ? sentenceObj.text : PLACEHOLDER_TEXT;
    const safeText = escapeHtml(text);

    if (dialog.textContent !== safeText) {
      dialog.textContent = safeText;
    }

    if (!dialog.classList.contains("mw-visible")) {
      dialog.classList.add("mw-visible");
      dialog.setAttribute("aria-hidden", "false");
      $(".mw-mascot-btn", root).setAttribute("aria-expanded", "true");
    }
  }

  function hideDialog(root) {
    const dialog = $(".mw-dialog", root);
    if (dialog.classList.contains("mw-visible")) {
      dialog.classList.remove("mw-visible");
      dialog.setAttribute("aria-hidden", "true");
      $(".mw-mascot-btn", root).setAttribute("aria-expanded", "false");
    }
  }

  // 悬停逻辑
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

  // 换装按钮逻辑
  function setupOutfitChangerLogic(root) {
    const changerBtn = $(".mw-outfit-changer-btn", root);

    changerBtn.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();

      const newOutfit = switchToNextOutfit();

      updateMascotImage(newOutfit);
      applyOutfitStyle(newOutfit);

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

      changerBtn.classList.add("mw-outfit-changer-btn-active");
      setTimeout(() => {
        changerBtn.classList.remove("mw-outfit-changer-btn-active");
      }, 200);
    });
  }

  // 页面进入时的 auto 触发
  function triggerAutoForUrl(root) {
    if (!sentences || sentences.length === 0) return;
    const href = location.href;
    const candidates = sentences.filter((s) => s.auto && isCandidate(s, href));
    if (!candidates || candidates.length === 0) return;
    const pick = weightedPickObjects(candidates);
    if (!pick) return;
    const dialog = $(".mw-dialog", root);
    if (dialog.classList.contains("mw-visible")) return;
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
    await loadSentences();
    setupHoverLogic(root);

    // 延迟设置换装按钮逻辑（等按钮插入后再绑定）
    setTimeout(() => {
      setupOutfitChangerLogic(root);
    }, 500);

    hookUrlChange(() => {
      triggerAutoForUrl(root);
    });
    triggerAutoForUrl(root);

    window.__MASCOT_WIDGET = Object.assign(window.__MASCOT_WIDGET || {}, {
      root,
      reloadSentences: reloadCurrentOutfitSentences,
      pickRandomLineWithChain: () => pickRandomLineWithChain(sentences),
      forceNext: (id) => (forcedNextId = id),
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
