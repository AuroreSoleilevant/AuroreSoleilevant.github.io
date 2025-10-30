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
  const STORAGE_KEY = "mascot-outfit-id";

  // ---------------- 小工具 ----------------
  const $ = (sel, root = document) => root.querySelector(sel);
  const escapeHtml = (s) =>
    String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  // ---------------- 换装系统 ----------------
  // ---------------- 换装系统 (已禁用) ----------------
  let currentOutfitIndex = 0;

  // 获取保存的换装ID
  function getSavedOutfitId() {
    return null;
  }

  // 保存换装ID
  function saveOutfitId(id) {
    // 什么都不做
  }

  // 初始化当前换装索引
  function initCurrentOutfitIndex() {
    currentOutfitIndex = 0;
  }

  // 获取当前换装
  function getCurrentOutfit() {
    // 返回默认值或空对象，避免报错
    return (
      MASCOT_CONFIG?.outfits?.[0] || { id: "default", image: "", label: "默认" }
    );
  }

  // 切换到下一个换装
  function switchToNextOutfit() {
    // 返回默认换装，不执行任何实际切换
    return getCurrentOutfit();
  }

  // 应用换装样式
  function applyOutfitStyle(outfit) {
    // 不应用任何样式
  }

  // 更新小马图片
  function updateMascotImage(outfit) {
    // 不更新图片
  }

  // 初始化调用也禁用
  // initCurrentOutfitIndex();  // 注释掉这行如果存在的话

  // ---------------- DOM 创建 ----------------
  // ---------------- DOM 创建（无闪 + 保留换装） ----------------
  function createWidget() {
    // 如果已有则返回
    const existing = document.getElementById(ID);
    if (existing) return existing;

    // 初始化当前换装
    initCurrentOutfitIndex();
    const currentOutfit = getCurrentOutfit();

    // 创建根节点
    const root = document.createElement("div");
    root.id = ID;
    root.setAttribute("aria-hidden", "false");

    // 创建主要按钮
    const btn = document.createElement("button");
    btn.className = "mw-mascot-btn";
    btn.setAttribute("aria-haspopup", "dialog");
    btn.setAttribute("aria-expanded", "false");
    btn.type = "button";

    // 创建图片节点，但不立即显示
    const img = document.createElement("img");
    img.alt = `左下角的${currentOutfit.label}`;
    img.style.opacity = "0";
    img.decoding = "async"; // 提示浏览器优化解码
    img.src = currentOutfit.image;

    // 图片加载完毕再显示，防止层级重建
    img.addEventListener("load", () => {
      img.style.transition = "opacity 0.25s ease";
      img.style.opacity = "1";
    });

    btn.appendChild(img);

    // 创建换装按钮（放在同级结构最后，避免额外层）
    const changerBtn = document.createElement("button");
    changerBtn.className = "mw-outfit-changer-btn";
    changerBtn.type = "button";
    changerBtn.title = "换套衣服";
    changerBtn.innerHTML = `<img src="/icons/icon-changer.svg" alt="换套衣服">`;

    // 创建对话框
    const dialog = document.createElement("div");
    dialog.className = "mw-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-hidden", "true");
    dialog.innerHTML = escapeHtml(PLACEHOLDER_TEXT);

    // 挂载顺序与旧版一致
    root.appendChild(btn);
    root.appendChild(changerBtn);
    root.appendChild(dialog);
    document.body.appendChild(root);

    // 应用样式（尽量不修改 transform / display）
    applyOutfitStyle(currentOutfit);

    return root;
  }

  // ---------------- SPA URL 变化钩子 ----------------
  // ---------------- SPA URL 变化钩子 (已禁用) ----------------
  function hookUrlChange(cb) {
    // 完全禁用历史记录监听
    // 不修改 history 方法，不添加任何事件监听器
    console.log("Mascot: URL change hook disabled (burnt to ground)");
  }

  // ---------------- 载入句子 JSON ----------------
  let sentences = [];
  let lastLoadedOutfitId = null;
  let sentencesLoading = false;
  let sentencesLoadPromise = null;
  async function loadSentences() {
    // 尽量避免重复 fetch
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
      // 已有缓存，直接返回
      return sentences;
    }

    // 如果已有正在进行的加载，重用该 promise（去重）
    if (sentencesLoading && sentencesLoadPromise) {
      return sentencesLoadPromise;
    }

    sentencesLoading = true;

    sentencesLoadPromise = (async () => {
      try {
        // 取消强制 no-store
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

  // ---------------- 重新加载当前换装的句子 ----------------
  function reloadCurrentOutfitSentences() {
    return loadSentences();
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
    const safeText = escapeHtml(text);

    // 只有文本变化时才写入
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

  // ---------------- 悬停逻辑（链式 pick） ----------------
  // ---------------- 悬停逻辑 (已禁用) ----------------
  function setupHoverLogic(root) {
    // 完全禁用所有鼠标和键盘交互
    console.log("Mascot: hover logic burnt to ground");
    // 不添加任何事件监听器
  }

  // ---------------- 换装按钮逻辑 ----------------
  // ---------------- 换装按钮逻辑 (已禁用) ----------------
  function setupOutfitChangerLogic(root) {
    // 完全禁用换装按钮的所有交互
    console.log("Mascot: outfit changer logic burnt to ground");
    // 不添加任何点击事件监听
  }

  // ---------------- 页面进入时的 auto 触发 ----------------
  // ---------------- 页面进入时的 auto 触发 (已禁用) ----------------
  function triggerAutoForUrl(root) {
    // 完全禁用自动显示
    console.log("Mascot: auto trigger disabled (burnt to ground)");
    // 不显示任何内容，不清除任何定时器
  }

  // ---------------- 初始化 ----------------
  // ---------------- 初始化 (已禁用) ----------------
  async function init() {
    const root = createWidget(); // 现在这个函数什么都不创建了
    console.log("Mascot: completely disabled - no DOM, no logic");
    return root;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
