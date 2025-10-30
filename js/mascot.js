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
  storageKey: "mascot-outfit-index", // 添加存储键名
};
/* ============================ */

(function () {
  if (window.__MASCOT_WIDGET_INJECTED) return;
  window.__MASCOT_WIDGET_INJECTED = true;

  if (window.innerWidth < (MASCOT_CONFIG.minScreenWidthToShow || 1024)) {
    return;
  }

  const ID = "mw-root";
  const PLACEHOLDER_TEXT = "Ciallo～(∠・ω< )⌒☆ 数据库大概没加载出来呜呜QAQ";

  // ---------------- 工具函数 ----------------
  const $ = (sel, root = document) => root.querySelector(sel);
  const escapeHtml = (s) =>
    String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  // ---------------- 状态管理 ----------------
  // 从存储中读取保存的换装索引，如果没有则使用0
  let currentOutfitIndex = (() => {
    try {
      const saved = localStorage.getItem(MASCOT_CONFIG.storageKey);
      return saved
        ? Math.max(
            0,
            Math.min(parseInt(saved), MASCOT_CONFIG.outfits.length - 1)
          )
        : 0;
    } catch (e) {
      return 0;
    }
  })();

  let sentences = [];
  let forcedNextId = null;
  let lastShownId = null;
  let autoTimer = null;

  // ---------------- 角色管理 ----------------
  function getCurrentOutfit() {
    return MASCOT_CONFIG.outfits[currentOutfitIndex];
  }

  async function applyOutfit(index, root) {
    currentOutfitIndex = index;
    const outfit = getCurrentOutfit();

    // 保存到本地存储
    try {
      localStorage.setItem(MASCOT_CONFIG.storageKey, index.toString());
    } catch (e) {
      console.warn("Mascot: Failed to save outfit index to localStorage");
    }

    // 直接更新头像图片，移除淡入淡出效果
    const img = $(".mw-mascot-btn img", root);
    if (img) {
      img.src = outfit.image;
    }

    // 更新对话框样式
    const dialog = $(".mw-dialog", root);
    if (dialog) {
      dialog.style.background = outfit.dialogBg;
      dialog.style.borderColor = outfit.dialogBorder;
      dialog.style.color = outfit.dialogTextColor;
    }

    // 重新加载句子
    await loadSentences();
  }

  // ---------------- DOM 创建 ----------------
  function createWidget() {
    if (document.getElementById(ID)) return document.getElementById(ID);

    const root = document.createElement("div");
    root.id = ID;
    root.setAttribute("aria-hidden", "false");

    const outfit = getCurrentOutfit();
    root.innerHTML = `
      <button class="mw-mascot-btn" aria-haspopup="dialog" aria-expanded="false" type="button">
        <img src="${outfit.image}" alt="左下角的晨曦初阳">
      </button>
      <div class="mw-dialog" role="dialog" aria-hidden="true" style="background: ${
        outfit.dialogBg
      }; border-color: ${outfit.dialogBorder}; color: ${
      outfit.dialogTextColor
    };">
        ${escapeHtml(PLACEHOLDER_TEXT)}
      </div>
    `;

    // 添加换装按钮
    const changeBtn = createChangeButton(root);
    root.appendChild(changeBtn);

    document.body.appendChild(root);
    return root;
  }

  function createChangeButton(root) {
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

    return btn;
  }

  // ---------------- 句子管理 ----------------
  async function loadSentences() {
    const outfit = getCurrentOutfit();
    if (!outfit || !outfit.sentencesUrl) {
      sentences = [];
      return;
    }

    try {
      const res = await fetch(outfit.sentencesUrl, { cache: "no-store" });
      if (!res.ok) throw new Error("fetch failed " + res.status);
      const j = await res.json();
      if (!Array.isArray(j)) throw new Error("sentences JSON must be an array");
      sentences = j;
      console.info(
        "Mascot: loaded",
        sentences.length,
        "sentences for",
        outfit.label
      );
    } catch (e) {
      console.warn("Mascot: failed to load sentences JSON:", e);
      sentences = [];
    }
  }

  // ---------------- 匹配规则（保持不变） ----------------
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

  // ---------------- 权重抽取（保持不变） ----------------
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

  // ---------------- 显示/隐藏逻辑 ----------------
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

  // ---------------- 悬停逻辑 ----------------
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

  // ---------------- 布局计算（保持不变） ----------------
  function computeBottom(root) {
    const footer = document.querySelector(
      "footer, .site-footer, #footer, .footer"
    );
    let extra = 120;
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

  // ---------------- SPA 支持（保持不变） ----------------
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

  // ---------------- 自动触发 ----------------
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
    computeBottom(root);
    await applyOutfit(currentOutfitIndex, root); // 使用保存的索引加载角色
    setupHoverLogic(root);

    hookUrlChange(() => {
      triggerAutoForUrl(root);
      computeBottom(root);
    });
    triggerAutoForUrl(root);

    window.addEventListener("resize", () => computeBottom(root));

    // 暴露接口
    window.__MASCOT_WIDGET = Object.assign(window.__MASCOT_WIDGET || {}, {
      root,
      reloadSentences: loadSentences,
      pickRandomLineWithChain: () => pickRandomLineWithChain(sentences),
      forceNext: (id) => (forcedNextId = id),
      getCurrentOutfit,
      applyOutfit: (index) => applyOutfit(index, root),
      getOutfitCount: () => MASCOT_CONFIG.outfits.length,
      getSavedOutfitIndex: () => currentOutfitIndex,
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
