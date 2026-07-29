(() => {
  const ROOT_SELECTOR = ".category-flow-wrapper";
  const TRACK_SELECTOR = ".flow-track";
  const COPY_SELECTOR = "[data-flow-copy]";
  const RESIZE_DELAY = 150;

  class TagFlowManager {
    constructor(root) {
      this.root = root;
      this.tracks = [...root.querySelectorAll(TRACK_SELECTOR)];
      this.inViewport = true;
      this.resizeTimer = null;
      this.motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      this.refresh = this.refresh.bind(this);
      this.syncPauseState = this.syncPauseState.bind(this);
    }

    init() {
      if (!this.tracks.length) return;

      document.addEventListener("visibilitychange", this.syncPauseState);
      window.addEventListener("pageshow", this.refresh);
      this.motionQuery.addEventListener("change", this.refresh);
      this.observeVisibility();
      this.observeSize();

      if (document.fonts?.ready) {
        document.fonts.ready.then(this.refresh).catch(() => {});
      }

      this.refresh();
    }

    observeVisibility() {
      if (!("IntersectionObserver" in window)) return;

      this.intersectionObserver = new IntersectionObserver(([entry]) => {
        this.inViewport = entry.isIntersecting;
        this.syncPauseState();
      });
      this.intersectionObserver.observe(this.root);
    }

    observeSize() {
      const scheduleRefresh = () => {
        clearTimeout(this.resizeTimer);
        this.resizeTimer = window.setTimeout(this.refresh, RESIZE_DELAY);
      };

      if ("ResizeObserver" in window) {
        this.resizeObserver = new ResizeObserver(scheduleRefresh);
        this.resizeObserver.observe(this.root);
        return;
      }

      window.addEventListener("resize", scheduleRefresh, { passive: true });
    }

    refresh() {
      const reducedMotion = this.motionQuery.matches;

      this.tracks.forEach((track) => {
        this.clearCopies(track);
        track.classList.remove("is-ready");
        track.style.removeProperty("--flow-distance");
        track.style.removeProperty("--flow-duration");

        if (reducedMotion) return;

        const source = track.querySelector(".flow-group");
        const lane = track.closest(".flow-lane");
        if (!source || !lane) return;

        const distance = Math.ceil(source.getBoundingClientRect().width);
        if (!distance) return;

        const copyCount = Math.max(1, Math.ceil(lane.clientWidth / distance));
        for (let index = 0; index < copyCount; index += 1) {
          track.appendChild(this.createCopy(source));
        }

        const pixelsPerSecond =
          track.dataset.flowDirection === "right" ? 30 : 34;
        track.style.setProperty("--flow-distance", `-${distance}px`);
        track.style.setProperty(
          "--flow-duration",
          `${Math.max(28, distance / pixelsPerSecond).toFixed(2)}s`
        );
        track.classList.add("is-ready");
      });

      this.syncPauseState();
    }

    createCopy(source) {
      const copy = source.cloneNode(true);
      copy.dataset.flowCopy = "";
      copy.setAttribute("aria-hidden", "true");
      copy.querySelectorAll("a").forEach((link) => {
        link.tabIndex = -1;
      });
      return copy;
    }

    clearCopies(track) {
      track.querySelectorAll(COPY_SELECTOR).forEach((copy) => copy.remove());
    }

    syncPauseState() {
      this.root.classList.toggle(
        "is-flow-paused",
        document.hidden || !this.inViewport
      );
    }
  }

  const initTagFlow = () => {
    if (window.__tagFlowManager) return;
    const root = document.querySelector(ROOT_SELECTOR);
    if (!root) return;

    window.__tagFlowManager = new TagFlowManager(root);
    window.__tagFlowManager.init();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initTagFlow, { once: true });
  } else {
    initTagFlow();
  }
})();
