/* page-number.js — 目录分页侧栏，由目录数据提供页数与翻页行为。 */
(function () {
  const MAIN_CONTENT_SELECTOR = ".main-content";

  function getCatalogueSection() {
    const segments = location.pathname.split("/").filter(Boolean);
    if (segments[0] === "tag" && segments[1] && segments.length === 2)
      return `tag/${segments[1]}`;
    if ((segments[0] === "histoire" || segments[0] === "article") && segments.length === 1)
      return segments[0];
    return null;
  }

  function getRequestedPage() {
    const value = new URLSearchParams(location.search).get("page");
    return /^\d+$/.test(value || "") ? Number(value) : 1;
  }

  function createModuleDom() {
    const container = document.createElement("div");
    container.id = "pg2-paginator";
    container.className = "pg2-paginator";
    container.setAttribute("role", "navigation");
    container.setAttribute("aria-label", "页面翻页");
    container.innerHTML = `
      <button class="pg2-btn pg2-prev" aria-label="上一页" type="button"></button>
      <div class="pg2-current" aria-current="page">1</div>
      <button class="pg2-btn pg2-next" aria-label="下一页" type="button"></button>
      <div class="pg2-jump">
        <input class="pg2-jump-input" type="text" inputmode="numeric" pattern="\\d*" placeholder="页码" aria-label="跳转页码输入" />
        <button class="pg2-jump-go" type="button" aria-label="前往">前往</button>
      </div>
    `;
    (document.querySelector(MAIN_CONTENT_SELECTOR) || document.body).appendChild(container);
    return container;
  }

  function arrowSvg(direction) {
    const path = direction === "left" ? "M15 18l-6-6 6-6" : "M9 6l6 6-6 6";
    return `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path d="${path}" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  function init() {
    if (!getCatalogueSection()) return;

    const module = document.getElementById("pg2-paginator") || createModuleDom();
    const prevBtn = module.querySelector(".pg2-prev");
    const nextBtn = module.querySelector(".pg2-next");
    const currentEl = module.querySelector(".pg2-current");
    const jumpWrap = module.querySelector(".pg2-jump");
    const jumpInput = module.querySelector(".pg2-jump-input");
    const goBtn = module.querySelector(".pg2-jump-go");
    let page = getRequestedPage();
    let totalPages = 1;
    let navigate = null;

    prevBtn.innerHTML = arrowSvg("left");
    nextBtn.innerHTML = arrowSvg("right");

    function setDisabled(button, disabled) {
      button.classList.toggle("pg2-disabled", disabled);
      button.toggleAttribute("aria-disabled", disabled);
      button.disabled = disabled;
    }

    function updateControls() {
      currentEl.textContent = String(page);
      setDisabled(prevBtn, page <= 1);
      setDisabled(nextBtn, page >= totalPages);
      const value = jumpInput.value.trim();
      setDisabled(goBtn, !/^\d+$/.test(value) || Number(value) < 1 || Number(value) > totalPages);
    }

    function goToPage(nextPage) {
      if (navigate) navigate(nextPage);
    }

    function acceptJump() {
      const target = Number.parseInt(jumpInput.value, 10);
      if (!Number.isInteger(target) || target < 1 || target > totalPages) {
        jumpWrap.classList.remove("pg2-shake");
        void jumpWrap.offsetWidth;
        jumpWrap.classList.add("pg2-shake");
        jumpInput.value = "";
        jumpInput.focus();
        updateControls();
        window.setTimeout(() => jumpWrap.classList.remove("pg2-shake"), 420);
        return;
      }
      goToPage(target);
    }

    prevBtn.addEventListener("click", () => goToPage(page - 1));
    nextBtn.addEventListener("click", () => goToPage(page + 1));
    goBtn.addEventListener("click", acceptJump);
    jumpInput.addEventListener("input", () => {
      jumpInput.value = jumpInput.value.replace(/[^\d]/g, "");
      updateControls();
    });
    jumpInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") acceptJump();
      if (event.key === "Escape") {
        jumpInput.value = "";
        updateControls();
      }
    });

    function applyPagination(detail) {
      if (!detail || typeof detail.navigate !== "function") return;
      page = detail.page;
      totalPages = detail.totalPages;
      navigate = detail.navigate;
      updateControls();
    }

    document.addEventListener("catalogue:pagination", (event) => applyPagination(event.detail));
    applyPagination(window.__cataloguePagination);
    updateControls();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
