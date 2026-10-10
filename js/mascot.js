/* mascot.js — 左下角小马 */

/* ========== 外部配置 ========== */
var MASCOT_CONFIG_URL = "/json/mascot.json";
var MASCOT_CONFIG_WAS_PROVIDED = Boolean(window.MASCOT_CONFIG);
var MASCOT_CONFIG = window.MASCOT_CONFIG || {
  outfits: [],
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
  const preloadedDiffImageUrls = new Set();

  // 防止重复注入
  if (window.__MASCOT_WIDGET_INJECTED) {
    return;
  }
  window.__MASCOT_WIDGET_INJECTED = true;

  const ID = "mw-root";
  const PLACEHOLDER_TEXT = "Ciallo～(∠・ω< )⌒☆";
  const $ = (sel, root = document) => root.querySelector(sel);

  const escapeHtml = (s) => {
    // 如果是颜文字，不进行转义
    if (s && /[<>]/.test(s) && !/<[a-z][\s\S]*>/i.test(s)) {
      // 包含 < 或 > 但不像是 HTML 标签，可能是颜文字。
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
  let outfitSwitchInProgress = false;
  const STORAGE_KEY = "mascot-outfit-id";
  const VISIBILITY_STORAGE_KEY = "mascot-hidden";

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

  function isMascotHidden() {
    try {
      return localStorage.getItem(VISIBILITY_STORAGE_KEY) === "true";
    } catch (e) {
      return false;
    }
  }

  function saveMascotVisibility(hidden) {
    try {
      localStorage.setItem(VISIBILITY_STORAGE_KEY, String(hidden));
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

  function getOutfitImageUrl(outfit, filename) {
    if (!outfit) return "";
    if (!outfit.imageDirectory) return outfit.image || "";

    const name = String(filename || outfit.defaultImage || "")
      .trim()
      .replace(/^\/+/, "");

    if (!name) return "";

    const directory = String(outfit.image || "").replace(/\/+$/, "");
    return `${directory}/${name}`;
  }

  function getDefaultOutfitImage(outfit) {
    if (!outfit) return "";

    return outfit.imageDirectory
      ? getOutfitImageUrl(outfit, outfit.defaultImage)
      : outfit.image || "";
  }

  // 同步菜单高亮和切换按钮的说明。
  function updateOutfitMenuSelection(root) {
    if (!root) return;

    const currentOutfit = getCurrentOutfit();
    const currentId = String(currentOutfit.id);

    root.querySelectorAll(".mw-outfit-option").forEach((item) => {
      const selected = item.dataset.outfitId === currentId;
      item.classList.toggle("mw-selected", selected);
      item.setAttribute("aria-checked", String(selected));
    });

    const changerBtn = $(".mw-outfit-changer-btn", root);
    if (changerBtn) {
      const label = currentOutfit.label || currentOutfit.id;
      const description = `选择吉祥物（当前：${label}）`;
      changerBtn.title = description;
      changerBtn.setAttribute("aria-label", description);
    }
  }

  // 关闭列表；只修改状态，淡出由 CSS 完成。
  function closeOutfitMenu(root, returnFocus = false) {
    if (!root) return;

    const menu = $(".mw-outfit-menu", root);
    const changerBtn = $(".mw-outfit-changer-btn", root);
    if (!menu || !changerBtn) return;

    // 先移走焦点，再隐藏菜单，避免焦点留在隐藏内容中。
    if (menu.contains(document.activeElement)) {
      if (
        returnFocus &&
        !changerBtn.disabled &&
        !root.classList.contains("mw-is-hidden")
      ) {
        changerBtn.focus({ preventScroll: true });
      } else {
        document.activeElement.blur();
      }
    }

    menu.classList.remove("mw-visible");
    menu.inert = true;
    menu.setAttribute("aria-hidden", "true");
    changerBtn.setAttribute("aria-expanded", "false");
  }

  // 指定 ID 切换：菜单和 Debug / API 共用此入口。
  async function switchToOutfit(id, { restoreFocus = false } = {}) {
    const root = document.getElementById(ID);
    const changerBtn = root && $(".mw-outfit-changer-btn", root);

    if (!root || !changerBtn || outfitSwitchInProgress) {
      return null;
    }

    const nextIndex = MASCOT_CONFIG.outfits.findIndex(
      (outfit) => String(outfit.id) === String(id)
    );

    if (nextIndex === -1) return null;

    // 即使点击当前选项，也关闭菜单，但不重复播放换装动画。
    closeOutfitMenu(root, restoreFocus);

    if (nextIndex === currentOutfitIndex) {
      return getCurrentOutfit();
    }

    outfitSwitchInProgress = true;
    changerBtn.disabled = true;
    hideDialog(root);

    const newOutfit = MASCOT_CONFIG.outfits[nextIndex];

    try {
      // 复用现有的预加载、尺寸同步及淡出 / 淡入。
      const imageUpdated = await updateMascotImage(newOutfit);
      if (!imageUpdated) return null;

      // 图片切换成功后，再提交当前选项和持久化状态。
      currentOutfitIndex = nextIndex;
      saveOutfitId(newOutfit.id);
      applyOutfitStyle(newOutfit);
      updateOutfitMenuSelection(root);

      // 若首次进入时的旧台词请求尚未完成，先等待它结束，
      // 避免把旧请求误当成新吉祥物的台词请求。
      if (STATE.sentencesLoadPromise) {
        await STATE.sentencesLoadPromise;
      }

      STATE.sentences = [];
      STATE.lastLoadedOutfitId = null;
      STATE.forcedNextId = null;
      STATE.lastShownId = null;

      await reloadCurrentOutfitSentences();

      return newOutfit;
    } catch (e) {
      console.warn("Mascot: failed to switch outfit:", e);
      return null;
    } finally {
      outfitSwitchInProgress = false;
      changerBtn.disabled = root.classList.contains("mw-is-hidden");

      // 键盘选择后恢复焦点，但不抢走用户已移到其他控件的焦点。
      if (
        restoreFocus &&
        !changerBtn.disabled &&
        (
          document.activeElement === document.body ||
          document.activeElement === changerBtn
        )
      ) {
        changerBtn.focus({ preventScroll: true });
      }
    }
  }

  const NIGHT_PAGE_RGB = [20, 25, 43];

  function parseCssColor(value) {
    if (!value || typeof value !== "string") return null;

    const color = value.trim();
    if (window.CSS && !window.CSS.supports("color", color)) return null;

    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;

    context.fillStyle = "#000";
    context.fillStyle = color;
    context.fillRect(0, 0, 1, 1);

    const pixel = context.getImageData(0, 0, 1, 1).data;
    return {
      rgb: [pixel[0] / 255, pixel[1] / 255, pixel[2] / 255],
      alpha: pixel[3] / 255,
    };
  }

  function compositeRgb(foreground, background, alpha) {
    return foreground.map(
      (channel, index) => channel * alpha + background[index] * (1 - alpha)
    );
  }

  function srgbToLinear(value) {
    return value <= 0.04045
      ? value / 12.92
      : Math.pow((value + 0.055) / 1.055, 2.4);
  }

  function linearToSrgb(value) {
    const channel = Math.max(0, Math.min(1, value));
    return channel <= 0.0031308
      ? 12.92 * channel
      : 1.055 * Math.pow(channel, 1 / 2.4) - 0.055;
  }

  function rgbToOklab(rgb) {
    const [r, g, b] = rgb.map(srgbToLinear);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

    return {
      L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
      a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
      b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
    };
  }

  function oklabToOklch(lab) {
    return {
      L: lab.L,
      C: Math.hypot(lab.a, lab.b),
      h: Math.atan2(lab.b, lab.a),
    };
  }

  function oklchToGamutRgb(L, C, h) {
    return oklabToGamutRgb(L, C * Math.cos(h), C * Math.sin(h));
  }

  function oklabToLinearRgb(L, a, b) {
    const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
    const m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
    const s = Math.pow(L - 0.0894841775 * a - 1.291485548 * b, 3);

    return [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ];
  }

  // Reduce chroma only when needed to keep the converted color inside sRGB.
  function oklabToGamutRgb(L, a, b) {
    const inGamut = (rgb) =>
      rgb.every((channel) => channel >= 0 && channel <= 1);

    let linear = oklabToLinearRgb(L, a, b);
    if (!inGamut(linear)) {
      let low = 0;
      let high = 1;

      for (let i = 0; i < 18; i += 1) {
        const scale = (low + high) / 2;
        const candidate = oklabToLinearRgb(L, a * scale, b * scale);
        if (inGamut(candidate)) {
          low = scale;
          linear = candidate;
        } else {
          high = scale;
        }
      }
    }

    return linear.map(linearToSrgb);
  }

  function rgbToCss(rgb, alpha = 1) {
    const channels = rgb.map((channel) =>
      Math.round(Math.max(0, Math.min(1, channel)) * 255)
    );
    return `rgba(${channels[0]}, ${channels[1]}, ${channels[2]}, ${alpha})`;
  }

  function relativeLuminance(rgb) {
    const [r, g, b] = rgb.map(srgbToLinear);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function contrastRatio(first, second) {
    const a = relativeLuminance(first);
    const b = relativeLuminance(second);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  }

  function adaptDialogColorsForNight(outfit) {
    const pageRgb = NIGHT_PAGE_RGB.map((channel) => channel / 255);
    const sourceBackground = parseCssColor(outfit.dialogBg);
    const sourceBorder = parseCssColor(outfit.dialogBorder);
    const sourceText = parseCssColor(outfit.dialogTextColor);

    let background = outfit.dialogBg;
    let border = outfit.dialogBorder;
    let text = outfit.dialogTextColor;

    let visibleSurface = pageRgb;
    if (sourceBackground) {
      const sourceSurface = compositeRgb(
        sourceBackground.rgb,
        pageRgb,
        sourceBackground.alpha
      );
      const sourceLch = oklabToOklch(rgbToOklab(sourceSurface));
      const nightL = Math.max(0.22, Math.min(0.4, 0.22 + 0.18 * sourceLch.L));
      const nightRgb = oklchToGamutRgb(
        nightL,
        sourceLch.C,
        sourceLch.h
      );
      const alpha = Math.max(0.84, sourceBackground.alpha);

      background = rgbToCss(nightRgb, alpha);
      visibleSurface = compositeRgb(nightRgb, pageRgb, alpha);
    }

    if (sourceBorder) {
      const borderSurface = compositeRgb(
        sourceBorder.rgb,
        pageRgb,
        sourceBorder.alpha
      );
      const borderLch = oklabToOklch(rgbToOklab(borderSurface));
      const surfaceL = rgbToOklab(visibleSurface).L;
      const borderL = Math.max(
        surfaceL + 0.1,
        Math.min(0.58, 0.36 + surfaceL)
      );
      const borderRgb = oklchToGamutRgb(
        Math.min(0.68, borderL),
        borderLch.C,
        borderLch.h
      );
      border = rgbToCss(borderRgb, Math.max(0.48, sourceBorder.alpha));
    }

    if (sourceText) {
      const textLch = oklabToOklch(rgbToOklab(sourceText.rgb));
      let best = null;

      // Keep the original hue/chroma as much as possible while meeting WCAG AA.
      for (let step = 0; step <= 200; step += 1) {
        const L = step / 200;
        const rgb = oklchToGamutRgb(L, textLch.C, textLch.h);
        const ratio = contrastRatio(rgb, visibleSurface);

        if (
          ratio >= 4.5 &&
          (!best || Math.abs(L - textLch.L) < Math.abs(best.L - textLch.L))
        ) {
          best = { L, rgb };
        }
      }

      if (!best) {
        const black = [0, 0, 0];
        const white = [1, 1, 1];
        best = contrastRatio(black, visibleSurface) >
          contrastRatio(white, visibleSurface)
          ? { rgb: black }
          : { rgb: white };
      }

      text = rgbToCss(best.rgb);
    }

    return { background, border, text };
  }

  function applyOutfitStyle(outfit) {
    const dialog = document.querySelector("#" + ID + " .mw-dialog");

    if (dialog && outfit) {
      const nightMode =
        document.documentElement.getAttribute("data-theme") === "dark";
      const nightColors = nightMode
        ? adaptDialogColorsForNight(outfit)
        : null;

      dialog.style.background =
        (nightColors && nightColors.background) ||
        outfit.dialogBg ||
        dialog.style.background;
      dialog.style.borderColor =
        (nightColors && nightColors.border) ||
        outfit.dialogBorder ||
        dialog.style.borderColor;
      dialog.style.color =
        (nightColors && nightColors.text) ||
        outfit.dialogTextColor ||
        dialog.style.color;
    }
  }

  // 根据图片实际宽高比，同步吉祥物容器高度。
  // 根容器的宽度由 CSS 控制，控制条和对话框跟随根容器定位。
  function syncMascotSize(root, naturalWidth, naturalHeight) {
    if (!root || !(naturalWidth > 0) || !(naturalHeight > 0)) {
      return false;
    }

    const displayWidth = parseFloat(getComputedStyle(root).width);
    if (!(displayWidth > 0)) return false;

    const displayHeight =
      displayWidth * naturalHeight / naturalWidth;

    root.style.setProperty(
      "--mw-mascot-height",
      `${displayHeight}px`
    );

    return true;
  }

  function preloadOutfitImage(outfit) {
    return new Promise((resolve, reject) => {
      const nextImage = new Image();
      nextImage.decoding = "async";
      nextImage.fetchPriority = "high";

      nextImage.onload = () => {
        const finish = () => resolve(nextImage);

        if (typeof nextImage.decode !== "function") {
          finish();
          return;
        }

        nextImage.decode().then(finish).catch(finish);
      };

      nextImage.onerror = reject;
      nextImage.src = getDefaultOutfitImage(outfit);
    });
  }

  function preloadLowPriorityImage(src) {
    return new Promise((resolve) => {
      const image = new Image();
      image.decoding = "async";
      image.fetchPriority = "low";

      image.onload = () => {
        if (typeof image.decode !== "function") {
          resolve(true);
          return;
        }

        image.decode()
          .then(() => resolve(true))
          .catch(() => resolve(true));
      };

      image.onerror = () => resolve(false);
      image.src = src;
    });
  }

  // 不能可靠地通过浏览器枚举目录，因此预加载台词 JSON 中实际引用的差分图。
  // 逐张、低优先级加载，不阻塞当前吉祥物和台词的初始化。
  async function preloadDifferenceImages(outfit, sentences) {
    if (!outfit || !outfit.imageDirectory || !Array.isArray(sentences)) {
      return;
    }

    const defaultName = String(outfit.defaultImage || "")
      .trim()
      .replace(/^\/+/, "");

    const filenames = [
      ...new Set(
        sentences
          .map((sentence) =>
            typeof sentence?.diffImage === "string"
              ? sentence.diffImage.trim().replace(/^\/+/, "")
              : ""
          )
          .filter((name) => name && name !== defaultName)
      ),
    ];

    for (const filename of filenames) {
      const src = getOutfitImageUrl(outfit, filename);
      if (!src || preloadedDiffImageUrls.has(src)) continue;

      preloadedDiffImageUrls.add(src);
      const succeeded = await preloadLowPriorityImage(src);

      if (!succeeded) {
        preloadedDiffImageUrls.delete(src);
      }
    }
  }

  async function updateMascotImage(outfit) {
    const root = document.getElementById(ID);
    const img = root && $(".mw-mascot-btn img", root);

    if (!root || !img || !outfit) return false;

    let nextImage;

    try {
      // 先加载和解码新图，期间保持当前图像可见。
      nextImage = await preloadOutfitImage(outfit);
    } catch (e) {
      return false;
    }

    if (
      !(nextImage.naturalWidth > 0) ||
      !(nextImage.naturalHeight > 0)
    ) {
      return false;
    }

    const wait = (ms) =>
      new Promise((resolve) => window.setTimeout(resolve, ms));

    try {
      // 图片和控制条一起淡出。
      root.classList.add("mw-is-switching");

      // 提交淡出状态，随后等待过渡完成。
      void root.offsetWidth;
      await wait(300);

      // 在完全淡出后更新高度，控制条在不可见状态下换位。
      syncMascotSize(
        root,
        nextImage.naturalWidth,
        nextImage.naturalHeight
      );

      img.src = getDefaultOutfitImage(outfit);
      img.alt = `左下角的${outfit.label}`;

      // 确保展示元素也已准备好新图。
      if (typeof img.decode === "function") {
        await img.decode().catch(() => {});
      }

      // 给新尺寸和定位留出渲染机会，再开始淡入。
      await new Promise((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve());
        });
      });

      // 图片和控制条在新位置一起淡入。
      root.classList.remove("mw-is-switching");
      await wait(300);

      return true;
    } finally {
      // 避免意外中断后残留淡出状态。
      root.classList.remove("mw-is-switching");
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

    // 首屏默认图像使用高优先级加载；多图吉祥物只加载指定的默认差分。
    const initialImage = getDefaultOutfitImage(currentOutfit);
    const img = new Image();
    img.src = initialImage;
    img.decoding = "async";
    img.loading = "eager";
    img.fetchPriority = "high";

    img.onload = () => {
      // 图片加载完成后再安全挂载内部结构
      root.innerHTML = `
      <div class="mw-controls" aria-label="吉祥物控制">
        <button class="mw-control-btn mw-visibility-btn" type="button" title="隐藏小可爱" aria-label="隐藏小可爱" aria-pressed="false">
          <img src="/icons/mascot-cat.svg" alt="" loading="lazy" decoding="async">
        </button>
        <button class="mw-control-btn mw-outfit-changer-btn" type="button" title="选择吉祥物" aria-label="选择吉祥物" aria-haspopup="menu" aria-expanded="false" aria-controls="mw-outfit-menu">
          <img src="/icons/icon-changer.svg" alt="" loading="lazy" decoding="async">
        </button>
        <div id="mw-outfit-menu" class="mw-outfit-menu" role="menu" aria-label="选择吉祥物" aria-hidden="true" inert></div>
      </div>
      <button class="mw-mascot-btn" aria-haspopup="dialog" aria-expanded="false" type="button">
        <img src="${initialImage}" alt="左下角的${currentOutfit.label}">
      </button>
      <div class="mw-dialog" role="dialog" aria-hidden="true">${escapeHtml(
        PLACEHOLDER_TEXT
      )}</div>
    `;

      const mascotImage = $(".mw-mascot-btn img", root);

      if (mascotImage) {
        // 后续台词差分图加载完成时，也同步实际比例。
        mascotImage.addEventListener("load", () => {
          // 换装期间由 updateMascotImage 明确更新尺寸，
          // 不让其他加载回调干扰这次换装定位。
          if (root.classList.contains("mw-is-switching")) return;

          syncMascotSize(
            root,
            mascotImage.naturalWidth,
            mascotImage.naturalHeight
          );
        });

        // 首次显示使用已经加载成功的预加载图片尺寸。
        syncMascotSize(root, img.naturalWidth, img.naturalHeight);
      }

      applyOutfitStyle(currentOutfit);

      // 主题运行时切换时，按当前角色重新派生对话框颜色。
      const themeObserver = new MutationObserver(() => {
        applyOutfitStyle(getCurrentOutfit());
      });
      themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme"],
      });

      setupOutfitChangerLogic(root);
      setupVisibilityLogic(root);

      // 按钮已创建，再绑定悬停、点击与键盘交互。
      setupHoverLogic(root);

      setMascotVisibility(root, isMascotHidden());

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
        if (!Array.isArray(j)) {
          throw new Error("sentences JSON must be an array");
        }

        STATE.sentences = j;
        STATE.lastLoadedOutfitId = currentOutfit.id;

        // 后台逐张预热差分图片，不等待队列完成。
        void preloadDifferenceImages(currentOutfit, j);

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
    ) {
      return true;
    }

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

      if (d < sentence.dateRange.from || d > sentence.dateRange.to) {
        return false;
      }
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
    const total = arr.reduce(
      (s, item) => s + (Number(item.weight) || 1),
      0
    );

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

      if (alt.length) {
        pick = weightedPickObjects(alt) || pick;
      }
    }

    if (!pick) return null;

    STATE.lastShownId = pick.id || null;
    if (pick.nextId) STATE.forcedNextId = pick.nextId;
    return pick;
  }

  function applySentenceEffects(root, sentenceObj) {
    if (!sentenceObj || outfitSwitchInProgress) return;

    const outfit = getCurrentOutfit();

    if (
      outfit &&
      outfit.imageDirectory &&
      sentenceObj.diffImage &&
      !root.classList.contains("mw-is-switching")
    ) {
      const img = $(".mw-mascot-btn img", root);
      const diffImageUrl = getOutfitImageUrl(
        outfit,
        sentenceObj.diffImage
      );

      if (
        img &&
        diffImageUrl &&
        img.getAttribute("src") !== diffImageUrl
      ) {
        // 直接替换 src，不执行换装淡出/淡入动画。
        // 图片加载完成后，由 load 监听同步容器高度。
        img.fetchPriority = "high";
        img.src = diffImageUrl;
      }
    }

    if (sentenceObj.bounce) {
      const mascotBtn = $(".mw-mascot-btn", root);

      if (mascotBtn) {
        mascotBtn.classList.remove("mw-bounce");

        // 强制重排，确保同一句台词再次触发时也会重新播放动画。
        void mascotBtn.offsetWidth;

        mascotBtn.classList.add("mw-bounce");
      }
    }
  }

  // ---------------- 显示 / 隐藏（仅在变化时写入） ----------------
  let autoTimer = null;

  function showText(root, sentenceObj) {
    const dialog = $(".mw-dialog", root);
    const text =
      sentenceObj && sentenceObj.text
        ? sentenceObj.text
        : PLACEHOLDER_TEXT;

    const safeText = escapeHtml(text);

    if (dialog && dialog.textContent !== safeText) {
      dialog.textContent = safeText;
    }

    applySentenceEffects(root, sentenceObj);

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
      if (outfitSwitchInProgress) return;

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
      dialog.addEventListener("mouseenter", () =>
        clearTimeout(hideTimer)
      );
      dialog.addEventListener("mouseleave", delayedHide);
    }

    btn.addEventListener("focus", showCandidateOnHover);
    btn.addEventListener("blur", delayedHide);

    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      if (!root) return;

      if (dialog && dialog.classList.contains("mw-visible")) {
        hideDialog(root);
      } else {
        showCandidateOnHover();
      }
    });

    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") hideDialog(root);
    });
  }

  // ---------------- 吉祥物选择列表逻辑 ----------------
  function setupOutfitChangerLogic(root) {
    const changerBtn = $(".mw-outfit-changer-btn", root);
    const menu = $(".mw-outfit-menu", root);
    if (!changerBtn || !menu) return;

    // 用 textContent 设置名称，避免把 label 当作 HTML。
    const fragment = document.createDocumentFragment();

    MASCOT_CONFIG.outfits.forEach((outfit) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "mw-outfit-option";
      item.dataset.outfitId = String(outfit.id);
      item.setAttribute("role", "menuitemradio");
      item.setAttribute("aria-checked", "false");
      item.tabIndex = -1;
      item.textContent = String(outfit.label ?? outfit.id);
      item.title = item.textContent;
      fragment.appendChild(item);
    });

    menu.replaceChildren(fragment);
    menu.inert = true;
    updateOutfitMenuSelection(root);

    const items = Array.from(
      menu.querySelectorAll(".mw-outfit-option")
    );

    function focusItem(index) {
      const item = items[index];
      if (!item) return;

      item.focus({ preventScroll: true });

      // 只滚动列表，不主动滚动页面。
      const top = item.offsetTop;
      const bottom = top + item.offsetHeight;

      if (top < menu.scrollTop) {
        menu.scrollTop = top;
      } else if (bottom > menu.scrollTop + menu.clientHeight) {
        menu.scrollTop = bottom - menu.clientHeight;
      }
    }

    function openMenu(focusIndex = currentOutfitIndex) {
      if (
        outfitSwitchInProgress ||
        changerBtn.disabled ||
        root.classList.contains("mw-is-hidden") ||
        root.classList.contains("mw-is-switching") ||
        items.length === 0
      ) {
        return;
      }

      // 按钮上方预留 10px 菜单间距和 10px 视口边距。
      const availableHeight =
        changerBtn.getBoundingClientRect().top - 20;

      if (availableHeight <= 0) return;

      menu.style.maxHeight =
        `${Math.min(240, availableHeight)}px`;

      hideDialog(root);
      updateOutfitMenuSelection(root);

      menu.inert = false;
      menu.setAttribute("aria-hidden", "false");
      menu.classList.add("mw-visible");
      changerBtn.setAttribute("aria-expanded", "true");

      focusItem(focusIndex);
    }

    changerBtn.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();

      if (outfitSwitchInProgress || changerBtn.disabled) return;

      if (menu.classList.contains("mw-visible")) {
        closeOutfitMenu(root, true);
      } else {
        openMenu();
      }
    });

    changerBtn.addEventListener("keydown", (ev) => {
      if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
        ev.preventDefault();
        openMenu(ev.key === "ArrowUp" ? items.length - 1 : 0);
      }
    });

    menu.addEventListener("click", (ev) => {
      const item = ev.target.closest(".mw-outfit-option");
      if (!item || !menu.contains(item)) return;

      ev.preventDefault();
      ev.stopPropagation();

      void switchToOutfit(item.dataset.outfitId, {
        restoreFocus: true,
      });
    });

    menu.addEventListener("keydown", (ev) => {
      const currentIndex = items.indexOf(document.activeElement);
      let nextIndex = null;

      switch (ev.key) {
        case "ArrowDown":
          nextIndex = (currentIndex + 1) % items.length;
          break;

        case "ArrowUp":
          nextIndex =
            (currentIndex - 1 + items.length) % items.length;
          break;

        case "Home":
          nextIndex = 0;
          break;

        case "End":
          nextIndex = items.length - 1;
          break;

        case "Escape":
          ev.preventDefault();
          ev.stopPropagation();
          closeOutfitMenu(root, true);
          return;

        case "Tab":
          // 返回触发按钮，再让浏览器正常处理 Tab。
          closeOutfitMenu(root, true);
          return;

        default:
          return;
      }

      ev.preventDefault();
      focusItem(nextIndex);
    });

    // 点击控制条之外的位置时关闭，不抢走外部控件的焦点。
    document.addEventListener("pointerdown", (ev) => {
      const controls = $(".mw-controls", root);

      if (
        menu.classList.contains("mw-visible") &&
        controls &&
        !controls.contains(ev.target)
      ) {
        closeOutfitMenu(root);
      }
    });

    // 焦点离开整个控制条时关闭。
    const controls = $(".mw-controls", root);

    if (controls) {
      controls.addEventListener("focusout", (ev) => {
        if (!controls.contains(ev.relatedTarget)) {
          closeOutfitMenu(root);
        }
      });
    }

    document.addEventListener("keydown", (ev) => {
      if (
        ev.key === "Escape" &&
        menu.classList.contains("mw-visible")
      ) {
        ev.preventDefault();
        closeOutfitMenu(root, true);
      }
    });

    // 视口变化后关闭，下次展开时重新计算可用高度。
    window.addEventListener("resize", () => {
      closeOutfitMenu(root);
    });
  }

  function setMascotVisibility(root, hidden) {
    root.classList.toggle("mw-is-hidden", hidden);
    root.setAttribute("data-mascot-hidden", String(hidden));

    const visibilityBtn = $(".mw-visibility-btn", root);

    if (visibilityBtn) {
      visibilityBtn.setAttribute("aria-pressed", String(hidden));
      visibilityBtn.setAttribute(
        "aria-label",
        hidden ? "显示小可爱" : "隐藏小可爱"
      );
      visibilityBtn.title = hidden ? "显示小可爱" : "隐藏小可爱";
    }

    if (hidden) {
      closeOutfitMenu(root);
      hideDialog(root);
    }

    const mascotBtn = $(".mw-mascot-btn", root);
    const outfitBtn = $(".mw-outfit-changer-btn", root);

    if (mascotBtn) mascotBtn.tabIndex = hidden ? -1 : 0;
    if (outfitBtn) {
      outfitBtn.disabled = hidden || outfitSwitchInProgress;
    }

    saveMascotVisibility(hidden);
  }

  function setupVisibilityLogic(root) {
    const visibilityBtn = $(".mw-visibility-btn", root);
    if (!visibilityBtn) return;

    visibilityBtn.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();

      setMascotVisibility(
        root,
        !root.classList.contains("mw-is-hidden")
      );
    });
  }

  // ---------------- 页面进入时的 auto 触发 ----------------
  function triggerAutoForUrl(root) {
    if (outfitSwitchInProgress) return;
    if (!STATE.sentences || STATE.sentences.length === 0) return;

    const href = location.href;
    const candidates = STATE.sentences.filter(
      (s) => s.auto && isCandidate(s, href)
    );

    if (!candidates || candidates.length === 0) return;

    const pick = weightedPickObjects(candidates);
    if (!pick) return;

    const dialog = $(".mw-dialog", root);

    // 不覆盖悬停
    if (dialog && dialog.classList.contains("mw-visible")) return;

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
      console.warn(
        "Mascot: loadSentences failed in init:",
        e
      );
    }

    // 悬停事件在 createWidget 的图片加载回调中绑定，
    // 确保按钮已经创建，且不重复绑定。
    hookUrlChange(() => {
      triggerAutoForUrl(root);
    });

    triggerAutoForUrl(root);

    // Debug / API
    window.__MASCOT_WIDGET = Object.assign(
      window.__MASCOT_WIDGET || {},
      {
        root,
        reloadSentences: reloadCurrentOutfitSentences,
        pickRandomLineWithChain: () =>
          pickRandomLineWithChain(STATE.sentences),
        forceNext: (id) => (STATE.forcedNextId = id),
        switchOutfit: (id) => switchToOutfit(id),
        getCurrentOutfit: () => getCurrentOutfit(),
      }
    );
  }

  async function start() {
    if (!MASCOT_CONFIG_WAS_PROVIDED) {
      try {
        const response = await fetch(MASCOT_CONFIG_URL);

        if (!response.ok) {
          throw new Error("fetch failed " + response.status);
        }

        const loadedConfig = await response.json();

        if (
          !loadedConfig ||
          !Array.isArray(loadedConfig.outfits) ||
          loadedConfig.outfits.length === 0
        ) {
          throw new Error(
            "mascot config JSON must contain a non-empty outfits array"
          );
        }

        const invalidOutfit = loadedConfig.outfits.find(
          (outfit) =>
            !outfit ||
            !outfit.id ||
            !outfit.image ||
            (outfit.imageDirectory && !outfit.defaultImage)
        );

        if (invalidOutfit) {
          throw new Error(
            "each outfit needs id/image; imageDirectory:true also requires defaultImage"
          );
        }

        MASCOT_CONFIG = {
          autoShowDuration: 6000,
          minScreenWidthToShow: 1024,
          ...loadedConfig,
        };

        window.MASCOT_CONFIG = MASCOT_CONFIG;
      } catch (e) {
        console.warn(
          "Mascot: failed to load config JSON:",
          e
        );
        return;
      }
    }

    if (
      !Array.isArray(MASCOT_CONFIG.outfits) ||
      MASCOT_CONFIG.outfits.length === 0
    ) {
      console.warn("Mascot: no outfits configured");
      return;
    }

    // 配置加载后再判断屏幕宽度，以保留 minScreenWidthToShow 的可配置性。
    if (
      window.innerWidth <
      (MASCOT_CONFIG.minScreenWidthToShow || 1024)
    ) {
      return;
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init, {
        once: true,
      });
    } else {
      init();
    }
  }

  void start();
})();