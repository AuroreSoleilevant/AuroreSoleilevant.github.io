(() => {
  const DATA_SOURCES = ["/json/article.json", "/json/histoire.json"];
  const RECOVERY_DELAY = 2200;
  const button = document.getElementById("randomLink");

  if (!button) return;

  let candidates = [];
  let candidatesRequest = null;
  let isNavigating = false;
  let recoveryTimer = null;

  const getPagePath = (value) => {
    const url = new URL(value, window.location.origin);
    return `${url.pathname.replace(/\/+$/, "") || "/"}${url.search}`;
  };

  const extractUrls = (items) =>
    Array.isArray(items)
      ? items
          .map((item) => item?.url)
          .filter((url) => typeof url === "string" && url.startsWith("/"))
      : [];

  const fetchUrls = async (source) => {
    try {
      const response = await fetch(source, { cache: "force-cache" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return extractUrls(await response.json());
    } catch (error) {
      console.warn("[随机按钮] 读取 JSON 失败：", source, error);
      return [];
    }
  };

  const loadCandidates = () => {
    if (candidates.length) return Promise.resolve(candidates);
    if (candidatesRequest) return candidatesRequest;

    candidatesRequest = Promise.all(DATA_SOURCES.map(fetchUrls))
      .then((results) => {
        candidates = [...new Set(results.flat())];
        return candidates;
      })
      .finally(() => {
        candidatesRequest = null;
      });

    return candidatesRequest;
  };

  const chooseCandidate = () => {
    const currentPage = getPagePath(window.location.href);
    const available = candidates.filter((url) => getPagePath(url) !== currentPage);
    if (!available.length) return null;
    return available[Math.floor(Math.random() * available.length)];
  };

  const resetButton = () => {
    window.clearTimeout(recoveryTimer);
    recoveryTimer = null;
    isNavigating = false;
    button.href = "#";
    button.removeAttribute("aria-disabled");
    button.textContent = "随机看看";
  };

  const navigateTo = (url) => {
    button.href = url;
    button.textContent = "走咯~";
    recoveryTimer = window.setTimeout(resetButton, RECOVERY_DELAY);
    button.click();
  };

  const handleClick = async (event) => {
    if (isNavigating) return;

    event.preventDefault();
    isNavigating = true;
    button.setAttribute("aria-disabled", "true");
    button.textContent = "准备中…";

    await loadCandidates();
    const target = chooseCandidate();
    if (!target) {
      button.title = "未找到可用页面";
      resetButton();
      return;
    }

    navigateTo(target);
  };

  button.addEventListener("click", handleClick);
  button.addEventListener("keydown", (event) => {
    if (event.key !== " ") return;
    event.preventDefault();
    button.click();
  });

  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(() => void loadCandidates(), { timeout: 2000 });
  } else {
    window.addEventListener("load", () => void loadCandidates(), { once: true });
  }
})();
