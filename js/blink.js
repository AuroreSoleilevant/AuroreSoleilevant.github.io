(function () {
  const defaultDuration = 2400; // 闪烁周期 ms
  const fadeOutDuration = 400; // 离开后平滑回到1的时间 ms
  const minOpacity = 0.05;
  const maxOpacity = 1;

  function initNavBlink() {
    document.querySelectorAll(".nav-item").forEach((elem) => {
      let animationFrame = null;
      let startTime = null;
      let hovering = false;

      function animate(time) {
        if (!startTime) startTime = time;
        const elapsed = time - startTime;
        const t = (elapsed % defaultDuration) / defaultDuration;
        const opacity =
          minOpacity +
          (maxOpacity - minOpacity) *
            (0.5 * (1 + Math.sin(Math.PI * 2 * t - Math.PI / 2)));
        elem.style.opacity = opacity;
        if (hovering) {
          animationFrame = requestAnimationFrame(animate);
        }
      }

      function startBlink() {
        hovering = true;
        startTime = null;
        if (animationFrame) cancelAnimationFrame(animationFrame);
        animationFrame = requestAnimationFrame(animate);
      }

      function stopBlinkSmooth() {
        hovering = false;
        if (animationFrame) cancelAnimationFrame(animationFrame);
        const currentOpacity = parseFloat(getComputedStyle(elem).opacity);
        const start = performance.now();

        function fade(time) {
          const elapsed = time - start;
          const t = Math.min(elapsed / fadeOutDuration, 1);
          elem.style.opacity = currentOpacity + (1 - currentOpacity) * t;
          if (t < 1) {
            requestAnimationFrame(fade);
          } else {
            elem.style.opacity = "1";
          }
        }
        requestAnimationFrame(fade);
      }

      elem.addEventListener("mouseenter", startBlink);
      elem.addEventListener("mouseleave", stopBlinkSmooth);
    });
  }

  // 等顶栏插入后初始化
  document.addEventListener("header:inserted", () => {
    initNavBlink();
  });

  // 如果页面本身有静态顶栏，也在 DOMContentLoaded 时初始化
  if (document.querySelector(".nav-item")) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initNavBlink);
    } else {
      initNavBlink();
    }
  }
})();
