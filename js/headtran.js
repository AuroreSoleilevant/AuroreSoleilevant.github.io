window.addEventListener("load", () => {
  const header = document.querySelector(".site-header");
  if (!header) return;
  let lastState = false;
  window.addEventListener("scroll", () => {
    const isScrolled = window.scrollY > 50;
    if (isScrolled !== lastState) {
      header.classList.toggle("scrolled", isScrolled);
      lastState = isScrolled;
    }
  });
});
