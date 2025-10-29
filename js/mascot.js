/* mascot.js — 左下角小马 */

/* ========== 配置区 ========== */
const MASCOT_CONFIG = {
  image: "/images/mascot/女巫.webp",
  sentencesUrl: "/json/mascot/女巫.json",
  autoShowDuration: 6000, // auto 显示时长（毫秒）
  minScreenWidthToShow: 1024, // 小于该宽度则不注入

  /* ===== 换装配置模板 =====
     outfits: 数组，每项可包含：
       id: 唯一id
       image: 头像图片地址
       sentencesUrl: 该套装的句子 JSON 地址
       dialogBg: 对话框背景（CSS color / rgba）
       dialogBorder: 边框颜色
       dialogTextColor: 文字颜色
  */
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
  /* ======================================== */
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
  const PLACEHOLDER_TEXT = "Ciallo～(∠・ω< )⌒☆ 数据库大概没加载出来呜呜QAQ"; //默认句子

  // ---------------- 小工具 ----------------
  const $ = (sel, root = document) => root.querySelector(sel);
  const escapeHtml = (s) =>
    String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  // ---------------- 换装相关状态 & 辅助 ----------------
  // 默认读取本地记忆的 outfit idx（或使用 outfits 中的第 0 项如果是首次访问）
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
    // 回退到 config 根部
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

  // ---------------- 温和的淡入淡出 applyOutfit ----------------
  // 说明：基于老版本实现，添加预加载 + 跨淡入淡出（保守短时过渡）
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

    // 如果图片跟当前一致，只切样式与语料，不做动画
    const currentSrc = imgEl ? imgEl.src || "" : "";
    const newSrc = outfit.image || "";

    // 记住索引并持久化（先保存，避免中断）
    currentOutfitIndex = index;
    saveCurrentOutfitIndex();

    // 小心操作按钮状态与聚焦，防止残留 focus 样式
    if (btn) {
      try {
        btn.blur();
      } catch (e) {}
    }

    // 1) 如果图片相同（可能只是切换 dialog 配色或句库），跳过动画
    if (currentSrc === newSrc || !imgEl) {
      // 直接应用对话框配色
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
      return;
    }

    // 2) 预加载新图（防止切换时出现空白）
    let preloadSucceeded = false;
    try {
      await new Promise((resolve) => {
        const p = new Image();
        let finished = false;
        const t = setTimeout(() => {
          if (!finished) {
            finished = true;
            resolve();
          }
        }, 800); // 超时时间：800ms

        p.onload = () => {
          if (!finished) {
            finished = true;
            clearTimeout(t);
            preloadSucceeded = true;
            resolve();
          }
        };
        p.onerror = () => {
          if (!finished) {
            finished = true;
            clearTimeout(t);
            resolve();
          }
        };
        p.src = newSrc;
      });
    } catch (e) {
      // ignore
    }

    try {
      // 禁用按钮以防重复点击（视觉上更安全）
      if (btn) btn.disabled = true;

      // 保证 img 有 transition（短期 inline，不会破坏你 CSS）
      if (imgEl) {
        const prevTransition = imgEl.style.transition;
        imgEl.style.transition = "opacity 240ms ease";

        // 淡出
        imgEl.style.opacity = "0";
        // 等待淡出完成
        await new Promise((res) => setTimeout(res, 260));

        // 如果预加载成功，用新 src（否则也尝试切换，容错）
        imgEl.src = newSrc;

        // 等待图片真实加载（若还未触发 load，等待短时）
        await new Promise((resolve) => {
          let resolved = false;
          const onLoad = () => {
            if (!resolved) {
              resolved = true;
              cleanup();
              resolve();
            }
          };
          const onError = () => {
            if (!resolved) {
              resolved = true;
              cleanup();
              resolve();
            }
          };
          const cleanup = () => {
            imgEl.removeEventListener("load", onLoad);
            imgEl.removeEventListener("error", onError);
          };
          imgEl.addEventListener("load", onLoad);
          imgEl.addEventListener("error", onError);
          // 保护：防止长时间等待（800ms）
          setTimeout(() => {
            if (!resolved) {
              resolved = true;
              cleanup();
              resolve();
            }
          }, 800);
        });

        // 淡入
        imgEl.style.opacity = "1";
        // 等待淡入完成
        await new Promise((res) => setTimeout(res, 260));

        // 恢复之前的 transition（如果之前没有设置则清空）
        imgEl.style.transition = prevTransition || "";
      }

      // 更新对话框配色
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
    } catch (e) {
      console.warn("Mascot: applyOutfit animation error:", e);
      // 出错时尽量设置 src 和样式，保证功能可用
      if (imgEl) imgEl.src = newSrc;
      if (dialog) {
        if (outfit.dialogBg) dialog.style.background = outfit.dialogBg;
        if (outfit.dialogBorder)
          dialog.style.border = `1px solid ${outfit.dialogBorder}`;
        if (outfit.dialogTextColor) dialog.style.color = outfit.dialogTextColor;
      }
      MASCOT_CONFIG.sentencesUrl =
        outfit.sentencesUrl || MASCOT_CONFIG.sentencesUrl;
      try {
        await loadSentences();
      } catch (e2) {}
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  // 在 root 上创建换装按钮（左上角小按钮）
  function createOutfitButton(root) {
    // 如果 outfits 数组长度 <= 1 就不创建（没必要）
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
    // 切换图标
    const img = document.createElement("img");
    img.src = "/icons/icon-changer.svg";
    img.alt = "换装";
    btn.innerHTML = ""; // 清空按钮内容
    btn.appendChild(img);

    btn.addEventListener("click", async (ev) => {
      ev.preventDefault();
      // 轮换下一套
      const next = (currentOutfitIndex + 1) % MASCOT_CONFIG.outfits.length;
      await applyOutfit(next, root);
      // 小提示：短暂显示当前套装 label（若有）
      const outfit = getCurrentOutfit();
      const label = outfit && outfit.label ? outfit.label : `套装 ${next + 1}`;
      // 在对话框临时显示套装名
      showText(root, { text: `已切换：${label}` });
      // auto 隐藏短时间
      setTimeout(() => {
        hideDialog(root);
      }, 1200);
      try {
        btn.blur();
      } catch (e) {}
    });

    // 把按钮放到 root 中（按钮位置通过 CSS 控制）
    root.appendChild(btn);
    return btn;
  }

  // ---------------- DOM 创建 ----------------
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

  // ---------------- 布局（考虑 footer） ----------------
  function computeBottom(root) {
    if (window._mw_position_timeout) {
      clearTimeout(window._mw_position_timeout);
    }

    window._mw_position_timeout = setTimeout(() => {
      const footer = document.querySelector(
        "footer, .site-footer, #footer, .footer"
      );
      let extra = 120;

      if (footer) {
        try {
          const rect = footer.getBoundingClientRect();
          if (rect.bottom >= window.innerHeight - 1) {
            extra = Math.max(40, rect.height + 30);
          }
        } catch (e) {}
      }

      root.style.bottom = extra + "px";
    }, 50);
  }

  function hookUrlChange(cb) {
    let urlChangeTimer = null;

    const wrappedCb = () => {
      if (urlChangeTimer) clearTimeout(urlChangeTimer);
      urlChangeTimer = setTimeout(cb, 100); // 延迟执行，等待页面稳定
    };

    ["pushState", "replaceState"].forEach((fnName) => {
      const orig = history[fnName];
      history[fnName] = function () {
        const res = orig.apply(this, arguments);
        window.dispatchEvent(new Event("mw-history-change"));
        return res;
      };
    });

    window.addEventListener("popstate", () => {
      window.dispatchEvent(new Event("mw-history-change"));
    });

    window.addEventListener("mw-history-change", wrappedCb);
  }

  // ---------------- 载入句子 JSON ----------------
  let sentences = [];
  async function loadSentences() {
    try {
      // 使用当前 outfit 指定的 URL（在 applyOutfit 中会更新 MASCOT_CONFIG.sentencesUrl）
      const url = MASCOT_CONFIG.sentencesUrl;
      const res = await fetch(url, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("fetch failed " + res.status);
      const j = await res.json();
      if (!Array.isArray(j)) throw new Error("sentences JSON must be an array");
      sentences = j;
      console.info("Mascot: loaded", sentences.length, "sentences from", url);
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
  // ---------------- 初始化 ----------------
  async function init() {
    const root = createWidget();

    // 同步应用当前outfit，不等待动画
    applyOutfit(currentOutfitIndex, root).then(() => {
      // 动画完成后的事情（如果有需要）
    });

    // 立即计算位置，不等待换装动画
    computeBottom(root);
    setupHoverLogic(root);
    hookUrlChange(() => {
      triggerAutoForUrl(root);
      // 在URL变化时，延迟一点再计算位置，确保页面稳定
      setTimeout(() => computeBottom(root), 100);
    });
    triggerAutoForUrl(root);

    window.addEventListener("resize", () => computeBottom(root));

    // 暴露一些接口用于调试/扩展，未来用吧
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
