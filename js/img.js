// 图片载入平滑
(() => {
  // 在 DOMContentLoaded 后执行主处理；重任务尽量在空闲时间跑
  function onReady(fn) {
    const schedule = (cb) => {
      if ("requestIdleCallback" in window) {
        requestIdleCallback(cb, { timeout: 200 });
      } else {
        // fallback：把任务放到微任务后，避免阻塞解析/渲染
        setTimeout(cb, 50);
      }
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => schedule(fn));
    } else {
      schedule(fn);
    }
  }

  // 标记并处理单个 <img> 的 loaded / aspectRatio 逻辑
  function handleImage(img) {
    // 避免重复处理同一 img
    if (img.dataset._handled === "1") return;
    img.dataset._handled = "1";

    // 优先使用 width/height 属性或 data-aspect / data-w/data-h
    const w = img.getAttribute("width");
    const h = img.getAttribute("height");
    const dataAspect = img.dataset.aspect;
    if (w && h) {
      img.style.aspectRatio = `${w} / ${h}`;
    } else if (dataAspect) {
      img.style.aspectRatio = dataAspect;
    } else if (img.dataset.w && img.dataset.h) {
      img.style.aspectRatio = `${img.dataset.w} / ${img.dataset.h}`;
    } else if (img.complete && img.naturalWidth && img.naturalHeight) {
      // 若已加载且具有 natural 尺寸，可直接设置 aspectRatio
      img.style.aspectRatio = `${img.naturalWidth} / ${img.naturalHeight}`;
    } // 否则不主动探测以避免额外网络请求

    // 将图片标记为 loaded：优先使用 decode()，失败则回退到直接添加类
    const markLoaded = () => {
      try {
        img.classList.add("loaded");
      } catch (e) {
        /* ignore */
      }
    };

    const tryDecodeThenMark = () => {
      if (img.decode) {
        img.decode().then(markLoaded).catch(markLoaded);
      } else {
        markLoaded();
      }
    };

    if (img.complete) {
      // 可能已经在缓存中，尽量 decode() 以获得更平滑渲染
      tryDecodeThenMark();
    } else {
      // 等待 load/error（只监听一次）
      const onLoad = () => tryDecodeThenMark();
      const onError = () => markLoaded(); // error 也视为“可以显示”，避免没了
      img.addEventListener("load", onLoad, { once: true, passive: true });
      img.addEventListener("error", onError, { once: true, passive: true });
    }
  }

  // 处理 background-image：避免重复下载，同 src 的只下载一次，并Mark所有相关元素
  function handleBgImages(root = document) {
    // 缓存已成功/失败处理过的 src
    const loadedSrc = new Set();
    const pendingMap = new Map(); // src -> [elements waiting]

    // 查找目标元素
    const els = Array.from(root.querySelectorAll(".bg-image"));
    if (!els.length) return;

    els.forEach((el) => {
      // 优先允许通过 data-bg-src 指定 URL
      const dataSrc = el.dataset.bgSrc;
      let src = dataSrc || null;

      // 如果没有 dataset，才去读取计算样式
      if (!src) {
        const cssBg = getComputedStyle(el).backgroundImage || "";
        const m = cssBg.match(/url\(["']?(.*?)["']?\)/);
        if (!m) return;
        src = m[1];
      }

      if (!src) return;

      // 如果已加载过，立即 mark
      if (loadedSrc.has(src)) {
        el.classList.add("loaded");
        return;
      }

      // 如果已有下载在进行，则把元素加入等待列表
      if (pendingMap.has(src)) {
        pendingMap.get(src).push(el);
        return;
      }

      // 创建等待列表并发起加载
      pendingMap.set(src, [el]);

      const img = new Image();
      img.src = src;

      // 成功或失败都统一标记并通知所有等待的元素
      const finish = () => {
        loadedSrc.add(src);
        const list = pendingMap.get(src) || [];
        list.forEach((waitingEl) => {
          try {
            waitingEl.classList.add("loaded");
          } catch (e) {
            /* ignore */
          }
        });
        pendingMap.delete(src);
      };

      // 监听 load/error，并加上超时回退
      let tim = setTimeout(() => {
        tim = null;
        finish();
      }, 3000); // 3s 回退

      img.addEventListener(
        "load",
        () => {
          if (tim) clearTimeout(tim);
          finish();
        },
        { once: true, passive: true }
      );
      img.addEventListener(
        "error",
        () => {
          if (tim) clearTimeout(tim);
          finish();
        },
        { once: true, passive: true }
      );
    });
  }

  // 主流程：处理所有 <img> 与背景图
  onReady(() => {
    try {
      // 一次性获取 HTMLCollection
      const imgs = document.images; // HTMLCollection
      // 分批处理以减少短时高 CPU
      const BATCH = 64; //每批 64 个
      let i = 0;
      const total = imgs.length;

      const processNextBatch = () => {
        const end = Math.min(i + BATCH, total);
        for (; i < end; i++) {
          try {
            handleImage(imgs[i]);
          } catch (e) {
            /* ignore per-image error */
          }
        }
        if (i < total) {
          // 安排下一批在空闲或短时延后执行
          if ("requestIdleCallback" in window) {
            requestIdleCallback(processNextBatch, { timeout: 200 });
          } else {
            setTimeout(processNextBatch, 30);
          }
        } else {
          // 所有 <img> 处理完后再处理背景图（避免并发过多）
          handleBgImages(document);
        }
      };

      processNextBatch();
    } catch (e) {
      // 若发生不可预期错误，尝试一次性处理作为回退
      try {
        document.querySelectorAll("img").forEach((img) => handleImage(img));
        handleBgImages(document);
      } catch (e2) {
        /* ignore final fallback errors */
      }
    }
  });
})();
