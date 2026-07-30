(() => {
  const ROOT_SELECTOR = ".category-flow-wrapper";
  const TRACK_SELECTOR = ".flow-track";
  const COPY_SELECTOR = "[data-flow-copy]";
  const RESIZE_DELAY = 150;
  const TAG_METADATA_PATH = "/json/tag.json";
  const SECTION_DATA_PATHS = {
    article: "/json/article.json",
    histoire: "/json/histoire.json",
  };

  class TagFlowManager {
    constructor(root) {
      this.root = root;
      this.container = root.querySelector(".flow-container");
      this.source = root.querySelector(".flow-source");
      this.tracks = [];
      this.inViewport = true;
      this.resizeTimer = null;
      this.motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      this.refresh = this.refresh.bind(this);
      this.syncPauseState = this.syncPauseState.bind(this);
    }

    async init() {
      const [tagsReady] = await Promise.all([
        this.hydrateSource(),
        this.updateSectionDates(),
      ]);
      if (!tagsReady) return;
      if (!this.buildTracks()) return;

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

    async hydrateSource() {
      if (!this.source) return false;

      try {
        const metadata = await (
          window.__tagMetadataRequest ||
          (window.__tagMetadataRequest = fetch(TAG_METADATA_PATH, {
            cache: "force-cache",
          }).then((response) => {
            if (!response.ok) throw new Error(`tag metadata: ${response.status}`);
            return response.json();
          }))
        );

        if (!Array.isArray(metadata)) throw new Error("tag metadata is not an array");

        const fragment = document.createDocumentFragment();
        for (const { fr, zh } of metadata) {
          if (typeof fr !== "string" || typeof zh !== "string" || !zh.trim()) continue;
          const link = document.createElement("a");
          link.className = "flow-tag";
          link.href = `/tag/${fr}/`;
          link.textContent = zh;
          fragment.appendChild(link);
        }

        this.source.replaceChildren(fragment);
        if (!this.source.querySelector(".flow-tag")) {
          throw new Error("tag metadata has no usable tags");
        }
        return true;
      } catch (error) {
        console.error("[tagflow] metadata unavailable:", error);
        return false;
      }
    }

    async updateSectionDates() {
      const sections = Object.entries(SECTION_DATA_PATHS);
      await Promise.all(
        sections.map(async ([section, path]) => {
          try {
            const response = await fetch(path, { cache: "force-cache" });
            if (!response.ok) throw new Error(`section data: ${response.status}`);
            const entries = await response.json();
            const latest = this.getLatestDate(entries);
            if (!latest) return;

            const desktop = this.formatDate(latest, true);
            const mobile = this.formatDate(latest, false);
            document
              .querySelectorAll(`[data-section-updated="${section}"]`)
              .forEach((element) => {
                const desktopNode = element.querySelector(".section-updated-date-desktop");
                const mobileNode = element.querySelector(".section-updated-date-mobile");
                if (desktopNode) desktopNode.textContent = desktop;
                if (mobileNode) mobileNode.textContent = mobile;
              });
          } catch (error) {
            console.warn(`[tagflow] ${section} update date unavailable:`, error);
          }
        })
      );
    }

    getLatestDate(entries) {
      if (!Array.isArray(entries)) return null;

      const latestTime = entries.reduce((latest, entry) => {
        const timestamps = [entry?.created_at, entry?.updated_at];
        return timestamps.reduce((currentLatest, timestamp) => {
          const time = Date.parse(timestamp);
          return Number.isFinite(time) ? Math.max(currentLatest, time) : currentLatest;
        }, latest);
      }, Number.NEGATIVE_INFINITY);

      return Number.isFinite(latestTime) ? new Date(latestTime) : null;
    }

    formatDate(date, includeYear) {
      const day = String(date.getUTCDate()).padStart(2, "0");
      const month = String(date.getUTCMonth() + 1).padStart(2, "0");
      return includeYear
        ? `${day}/${month}/${date.getUTCFullYear()}`
        : `${date.getUTCDate()}/${date.getUTCMonth() + 1}`;
    }

    buildTracks() {
      if (!this.container || !this.source) return false;

      const tags = [...this.source.querySelectorAll(".flow-tag")];
      if (!tags.length) return false;

      const midpoint = Math.ceil(tags.length / 2);
      const rows = [tags.slice(0, midpoint), tags.slice(midpoint)];
      const fragment = document.createDocumentFragment();

      rows.forEach((row, index) => {
        if (!row.length) return;

        const lane = document.createElement("div");
        lane.className = "flow-lane";
        const track = document.createElement("div");
        track.className = "flow-track";
        track.dataset.flowDirection = index === 0 ? "left" : "right";
        const group = document.createElement("div");
        group.className = "flow-group";
        row.forEach((tag) => group.appendChild(tag));
        track.appendChild(group);
        lane.appendChild(track);
        fragment.appendChild(lane);
      });

      this.container.appendChild(fragment);
      this.tracks = [...this.container.querySelectorAll(TRACK_SELECTOR)];
      this.root.classList.add("is-flow-ready");
      return this.tracks.length > 0;
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
