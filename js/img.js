document.addEventListener("DOMContentLoaded", () => {
  // 处理 <img>
  document.querySelectorAll("img").forEach((img) => {
    // prefer native width/height attributes
    const w = img.getAttribute("width");
    const h = img.getAttribute("height");
    const dataAspect = img.dataset.aspect; // e.g. "16/9" or "1/1"
    if (w && h) {
      img.style.aspectRatio = `${w} / ${h}`;
    } else if (dataAspect) {
      img.style.aspectRatio = dataAspect;
    } else if (img.dataset.w && img.dataset.h) {
      img.style.aspectRatio = `${img.dataset.w} / ${img.dataset.h}`;
    } else {
      // 如果既没有宽高也没有 data-aspect，可以预加载获取比例（会发请求）
      // 只在必要时启用（注释掉以避免额外请求）
      /*
      const probe = new Image();
      probe.src = img.currentSrc || img.src;
      probe.onload = () => {
        if (probe.naturalWidth && probe.naturalHeight) {
          img.style.aspectRatio = `${probe.naturalWidth} / ${probe.naturalHeight}`;
        }
      };
      */
    }

    // 当图片真正准备好（解码完）时添加 loaded 类，触发弹出动画
    const markLoaded = () => img.classList.add("loaded");
    if (img.complete) {
      // 可能已经缓存完成，尝试 decode() 更平滑
      if (img.decode) {
        img.decode().then(markLoaded).catch(markLoaded);
      } else {
        markLoaded();
      }
    } else {
      img.addEventListener(
        "load",
        () => {
          if (img.decode) {
            img.decode().then(markLoaded).catch(markLoaded);
          } else {
            markLoaded();
          }
        },
        { once: true }
      );
      img.addEventListener(
        "error",
        () => {
          img.classList.add("loaded"); // 避免永远隐形
        },
        { once: true }
      );
    }
  });

  // 处理 background-image 的占位与加载
  document.querySelectorAll(".bg-image").forEach((el) => {
    const url = getComputedStyle(el).backgroundImage;
    // 从 background-image: url("...") 解析 URL（简单处理）
    const m = url && url.match(/url\(["']?(.*?)["']?\)/);
    if (!m) return;
    const src = m[1];
    const img = new Image();
    img.src = src;
    img.onload = () => el.classList.add("loaded");
    img.onerror = () => el.classList.add("loaded");
  });
});
