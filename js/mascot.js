/* mascot.js — 左下角小马 */

/* ========== 配置区 ========== */
const MASCOT_CONFIG = {
  image: "/images/mascot/女巫.webp",
  sentencesUrl: "/json/mascot/女巫.json",
  autoShowDuration: 6000,
  minScreenWidthToShow: 1024,

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
};

(function () {
  if (window.__MASCOT_WIDGET_INJECTED) return;
  window.__MASCOT_WIDGET_INJECTED = true;

  if (window.innerWidth < (MASCOT_CONFIG.minScreenWidthToShow || 1024)) {
    return;
  }

  const ID = "mw-root";
  const PLACEHOLDER_TEXT = "Ciallo～(∠・ω< )⌒☆ 数据库大概没加载出来呜呜QAQ";

  const $ = (sel, root = document) => root.querySelector(sel);
  const escapeHtml = (s) =>
    String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  let currentOutfitIndex = 0;
  (function loadSavedOutfit() {
    try {
      const saved = localStorage.getItem("mascot_outfit_index");
      if (saved !== null && !isNaN(Number(saved))) {
        const idx = Number(saved);
        if (
          Array.isArray(MASCOT_CONFIG.outfits) &&
          idx >= 0 &&
          idx < MASCOT_CONFIG.outfits.length
        ) {
          currentOutfitIndex = idx;
        }
      }
    } catch (e) {}
  })();

  function getCurrentOutfit() {
    if (
      Array.isArray(MASCOT_CONFIG.outfits) &&
      MASCOT_CONFIG.outfits.length > 0
    ) {
      return MASCOT_CONFIG.outfits[currentOutfitIndex];
    }
    return {
      image: MASCOT_CONFIG.image,
      sentencesUrl: MASCOT_CONFIG.sentencesUrl,
      dialogBg: undefined,
      dialogBorder: undefined,
      dialogTextColor: undefined,
    };
  }

  function saveCurrentOutfitIndex() {
    try {
      localStorage.setItem("mascot_outfit_index", String(currentOutfitIndex));
    } catch (e) {}
  }

  async function applyOutfit(index, root) {
    if (
      !Array.isArray(MASCOT_CONFIG.outfits) ||
      MASCOT_CONFIG.outfits.length === 0
    )
      return;
    index = Math.max(0, Math.min(index, MASCOT_CONFIG.outfits.length - 1));

    const outfit = MASCOT_CONFIG.outfits[index];
    if (!outfit) return;

    const imgEl = $(".mw-mascot-btn img", root);
    const dialog = $(".mw-dialog", root);
    const btn = $(".mw-outfit-btn", root);

    currentOutfitIndex = index;
    saveCurrentOutfitIndex();

    if (btn) {
      try {
        btn.blur();
      } catch (e) {}
    }

    // 直接切换图片，无动画
    if (imgEl) {
      imgEl.src = outfit.image || "";
    }

    // 应用对话框配色
    if (dialog) {
      if (outfit.dialogBg) dialog.style.background = outfit.dialogBg;
      else dialog.style.background = "";
      if (outfit.dialogBorder)
        dialog.style.border = `1px solid ${outfit.dialogBorder}`;
      else dialog.style.border = "";
      if (outfit.dialogTextColor) dialog.style.color = outfit.dialogTextColor;
      else dialog.style.color = "";
    }

    // 更新全局 sentences url 并重新加载句子
    MASCOT_CONFIG.sentencesUrl =
      outfit.sentencesUrl || MASCOT_CONFIG.sentencesUrl;
    await loadSentences();
  }

  function createOutfitButton(root) {
    if (
      !Array.isArray(MASCOT_CONFIG.outfits) ||
      MASCOT_CONFIG.outfits.length <= 1
    )
      return null;
    if ($(".mw-outfit-btn", root)) return $(".mw-outfit-btn", root);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mw-outfit-btn";
    btn.setAttribute("aria-label", "切换换装");
    btn.title = "切换换装";

    const img = document.createElement("img");
    img.src = "/icons/icon-changer.svg";
    img.alt = "换装";
    btn.appendChild(img);

    btn.addEventListener("click", async (ev) => {
      ev.preventDefault();
      const next = (currentOutfitIndex + 1) % MASCOT_CONFIG.outfits.length;
      await applyOutfit(next, root);

      const outfit = getCurrentOutfit();
      const label = outfit && outfit.label ? outfit.label : `套装 ${next + 1}`;
      showText(root, { text: `已切换：${label}` });

      setTimeout(() => {
        hideDialog(root);
      }, 1200);

      try {
        btn.blur();
      } catch (e) {}
    });

    root.appendChild(btn);
    return btn;
  }

  function createWidget() {
    if (document.getElementById(ID)) return document.getElementById(ID);
    const root = document.createElement("div");
    root.id = ID;
    root.setAttribute("aria-hidden", "false");
    root.innerHTML = `
      <button class="mw-mascot-btn" aria-haspopup="dialog" aria-expanded="false" type="button">
        <img src="${
          getCurrentOutfit().image || MASCOT_CONFIG.image
        }" alt="左下角的晨曦初阳">
      </button>
      <div class="mw-dialog" role="dialog" aria-hidden="true">${escapeHtml(
        PLACEHOLDER_TEXT
      )}</div>
    `;
    document.body.appendChild(root);

    createOutfitButton(root);
    return root;
  }

  // 移除所有位置计算和URL变化钩子

  let sentences = [];
  async function loadSentences() {
    try {
      const url = MASCOT_CONFIG.sentencesUrl;
      const res = await fetch(url, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("fetch failed " + res.status);
      const j = await res.json();
      if (!Array.isArray(j)) throw new Error("sentences JSON must be an array");
      sentences = j;
    } catch (e) {
      console.warn("Mascot: failed to load sentences JSON:", e);
      sentences = [];
    }
  }

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

  async function init() {
    const root = createWidget();
    await applyOutfit(currentOutfitIndex, root);
    setupHoverLogic(root);
    triggerAutoForUrl(root);

    window.__MASCOT_WIDGET = Object.assign(window.__MASCOT_WIDGET || {}, {
      root,
      reloadSentences: loadSentences,
      pickRandomLineWithChain: () => pickRandomLineWithChain(sentences),
      forceNext: (id) => (forcedNextId = id),
      getCurrentOutfitIndex: () => currentOutfitIndex,
      setOutfitIndex: (i) =>
        applyOutfit(
          i,
          window.__MASCOT_WIDGET && window.__MASCOT_WIDGET.root
            ? window.__MASCOT_WIDGET.root
            : document.getElementById(ID)
        ),
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
