(() => {
  const MAIN_ID = "spica-main";

  function prepareSkipLink() {
    const main = document.querySelector("main");
    const link = document.querySelector(".skip-link");
    if (!main || !link || link.dataset.skipLinkReady === "true") return;

    if (!main.id) main.id = MAIN_ID;
    main.tabIndex = -1;
    link.dataset.skipLinkReady = "true";
    link.addEventListener("click", () => {
      main.focus({ preventScroll: true });
    });
  }

  function init() {
    prepareSkipLink();
    if (!document.querySelector(".skip-link")) {
      document.addEventListener("header:inserted", prepareSkipLink, { once: true });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
